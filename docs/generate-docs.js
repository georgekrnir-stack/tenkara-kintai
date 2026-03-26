import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle,
  Header, Footer, PageNumber, NumberFormat,
  TableOfContents, ShadingType, PageBreak, TableLayoutType,
} from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========================================
// 共通スタイル定義
// ========================================
const BLUE = '2563EB';
const DARK_BLUE = '1E40AF';
const LIGHT_BLUE = 'EFF6FF';
const GRAY = '6B7280';
const DARK = '1F2937';
const LIGHT_GRAY = 'F3F4F6';

const defaultStyles = {
  default: {
    document: {
      run: { font: 'Yu Gothic', size: 21, color: DARK },
      paragraph: { spacing: { after: 120, line: 300 } },
    },
    heading1: {
      run: { font: 'Yu Gothic', size: 32, bold: true, color: DARK_BLUE },
      paragraph: { spacing: { before: 400, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE } } },
    },
    heading2: {
      run: { font: 'Yu Gothic', size: 26, bold: true, color: BLUE },
      paragraph: { spacing: { before: 300, after: 150 } },
    },
    heading3: {
      run: { font: 'Yu Gothic', size: 22, bold: true, color: DARK },
      paragraph: { spacing: { before: 200, after: 100 } },
    },
  },
};

// ========================================
// ヘルパー関数
// ========================================
function p(text, options = {}) {
  const { bold, italic, size, color, alignment, spacing, indent, bullet, heading } = options;
  const runs = Array.isArray(text)
    ? text.map(t => typeof t === 'string' ? new TextRun({ text: t, font: 'Yu Gothic' }) : new TextRun({ ...t, font: 'Yu Gothic' }))
    : [new TextRun({ text, bold, italic, size: size ? size * 2 : undefined, color, font: 'Yu Gothic' })];

  return new Paragraph({
    children: runs,
    alignment,
    spacing,
    indent,
    bullet: bullet ? { level: 0 } : undefined,
    heading,
  });
}

function h1(text) {
  return p(text, { heading: HeadingLevel.HEADING_1 });
}

function h2(text) {
  return p(text, { heading: HeadingLevel.HEADING_2 });
}

function h3(text) {
  return p(text, { heading: HeadingLevel.HEADING_3 });
}

function bulletItem(text, options = {}) {
  const runs = Array.isArray(text)
    ? text.map(t => typeof t === 'string' ? new TextRun({ text: t, font: 'Yu Gothic' }) : new TextRun({ ...t, font: 'Yu Gothic' }))
    : [new TextRun({ text, font: 'Yu Gothic' })];
  return new Paragraph({ children: runs, bullet: { level: options.level || 0 } });
}

function emptyLine() {
  return new Paragraph({ children: [] });
}

function note(text) {
  return new Paragraph({
    children: [new TextRun({ text: `※ ${text}`, italics: true, color: GRAY, size: 19, font: 'Yu Gothic' })],
    indent: { left: 360 },
    shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' },
    spacing: { before: 100, after: 100 },
  });
}

function makeTable(headers, rows) {
  // A4 content width = 11906 - 1134*2 = 9638 DXA
  const TABLE_WIDTH = 9638;
  const colCount = headers.length;
  const colWidth = Math.floor(TABLE_WIDTH / colCount);
  const colWidths = Array(colCount).fill(colWidth);

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
  };
  const cellMargins = { top: 60, bottom: 60, left: 120, right: 120 };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, ci) => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', font: 'Yu Gothic', size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 240 },
      })],
      shading: { type: ShadingType.CLEAR, fill: BLUE },
      borders: cellBorders,
      margins: cellMargins,
      width: { size: colWidths[ci], type: WidthType.DXA },
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: String(cell), font: 'Yu Gothic', size: 20 })],
        spacing: { before: 0, after: 0, line: 240 },
      })],
      shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: LIGHT_GRAY } : undefined,
      borders: cellBorders,
      margins: cellMargins,
      width: { size: colWidths[ci], type: WidthType.DXA },
    })),
  }));

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: colWidths,
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function coverPage(title, subtitle, date) {
  return [
    ...Array(8).fill(null).map(() => emptyLine()),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 56, color: DARK_BLUE, font: 'Yu Gothic' })],
      alignment: AlignmentType.CENTER,
    }),
    emptyLine(),
    new Paragraph({
      children: [new TextRun({ text: subtitle, size: 28, color: GRAY, font: 'Yu Gothic' })],
      alignment: AlignmentType.CENTER,
    }),
    ...Array(4).fill(null).map(() => emptyLine()),
    new Paragraph({
      children: [new TextRun({ text: '飛騨牛食べ処てんから', size: 24, color: DARK, font: 'Yu Gothic' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: date, size: 22, color: GRAY, font: 'Yu Gothic' })],
      alignment: AlignmentType.CENTER,
    }),
    pageBreak(),
  ];
}

function makeHeader(text) {
  return new Header({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 16, color: GRAY, font: 'Yu Gothic' })],
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' } },
      }),
    ],
  });
}

function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: '飛騨牛食べ処てんから  |  ', size: 16, color: GRAY, font: 'Yu Gothic' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: 'Yu Gothic' }),
          new TextRun({ text: ' / ', size: 16, color: GRAY, font: 'Yu Gothic' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRAY, font: 'Yu Gothic' }),
        ],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' } },
      }),
    ],
  });
}

// ========================================
// マニュアル生成
// ========================================
function generateManual() {
  const date = '2026年3月';

  const sections = [];

  // 表紙
  sections.push(...coverPage(
    'てんから勤怠システム',
    '操作マニュアル',
    date
  ));

  // 目次ページ
  sections.push(
    h1('目次'),
    p(''),
    ...[
      '1. システム概要',
      '2. 初回セットアップ',
      '3. 打刻ページ（従業員向け）',
      '4. 管理者ログイン',
      '5. ダッシュボード',
      '6. スタッフ管理',
      '7. 勤怠管理',
      '8. 給与計算',
      '9. 帳票出力',
      '10. 従業員ページ',
      '11. 毎月の運用フロー',
      '12. 給与計算ルール詳細',
    ].map(item => p(item, { size: 12 })),
    pageBreak(),
  );

  // 第1章: システム概要
  sections.push(
    h1('1. システム概要'),
    p('本システムは以下の3つの画面で構成されています。'),
    makeTable(
      ['画面', 'URL', '対象', '用途'],
      [
        ['打刻ページ', '/punch', '全従業員', 'タブレットで出退勤を記録'],
        ['管理画面', '/admin', '管理者', 'スタッフ管理・勤怠・給与・帳票'],
        ['従業員ページ', '/employee/:token', '各従業員', '自分の勤怠・給与を確認'],
      ]
    ),
    emptyLine(),
  );

  // 第2章: 初回セットアップ
  sections.push(
    h1('2. 初回セットアップ'),
    p('初めてシステムにアクセスすると、管理者パスワードの設定画面が表示されます。'),
    bulletItem('ブラウザで /admin にアクセス'),
    bulletItem('「管理者パスワードを設定」画面が表示される'),
    bulletItem('パスワードを入力（4文字以上）'),
    bulletItem('「セットアップ完了」ボタンを押す'),
    bulletItem('自動的にログイン画面に遷移'),
    note('このパスワードは後から変更できません。忘れないよう管理してください。'),
    emptyLine(),
  );

  // 第3章: 打刻ページ
  sections.push(
    h1('3. 打刻ページ（従業員向け）'),
    p([
      { text: 'URL: ', bold: true },
      { text: '/punch' },
    ]),
    p('店舗のタブレットに常時表示して使用します。'),
    h2('画面構成'),
    bulletItem('リアルタイム時計: 画面上部に大きく現在時刻を表示（毎秒更新）'),
    bulletItem('スタッフ一覧: 名前と現在の状態をグリッド表示'),
    h2('打刻の手順'),
    bulletItem('自分の名前をタップ'),
    bulletItem('現在の状態に応じたボタンが表示される'),
    bulletItem('該当するボタンをタップ'),
    h2('ボタンと状態遷移'),
    makeTable(
      ['現在の状態', '表示されるボタン'],
      [
        ['未出勤', '出勤（緑）'],
        ['出勤中', '退勤（赤）・休憩開始（黄）'],
        ['休憩中', '休憩終了（青）'],
        ['退勤済み', '出勤（緑）※再出勤'],
      ]
    ),
    emptyLine(),
    note('打刻成功時はメッセージが5秒間表示されます。スタッフ一覧は30秒ごとに自動更新されます。'),
    emptyLine(),
  );

  // 第4章: 管理者ログイン
  sections.push(
    h1('4. 管理者ログイン'),
    p([{ text: 'URL: ', bold: true }, { text: '/admin/login' }]),
    bulletItem('セットアップ時に設定したパスワードを入力'),
    bulletItem('「ログイン」ボタンを押す'),
    bulletItem('ログイン後24時間有効（自動的にセッション維持）'),
    emptyLine(),
  );

  // 第5章: ダッシュボード
  sections.push(
    h1('5. ダッシュボード'),
    p([{ text: 'URL: ', bold: true }, { text: '/admin（ログイン後のトップ画面）' }]),
    h2('サマリーカード'),
    p('画面上部に4つのカードで当日の出勤状況をリアルタイム表示します。'),
    makeTable(
      ['カード', '内容'],
      [
        ['出勤中（緑）', '現在勤務中の人数'],
        ['休憩中（黄）', '休憩中の人数'],
        ['退勤済み（青）', '退勤済みの人数'],
        ['未出勤（灰）', 'まだ出勤していない人数'],
      ]
    ),
    h2('タイムライン'),
    bulletItem('横軸: 6:00〜翌2:00'),
    bulletItem('青色バー: 勤務時間 / 灰色バー: 休憩時間'),
    bulletItem('赤色縦線: 現在時刻（当日表示時）'),
    bulletItem('紫色ゾーン: 深夜帯（22:00以降）'),
    h2('スタッフ状態一覧'),
    p('各スタッフの名前・現在の状態・打刻履歴を一覧表示します。'),
    h2('日付の切り替え'),
    p('画面右上の日付入力から、過去の日付のデータも確認できます。'),
    emptyLine(),
  );

  // 第6章: スタッフ管理
  sections.push(
    h1('6. スタッフ管理'),
    p([{ text: 'URL: ', bold: true }, { text: '/admin/staff' }]),
    h2('スタッフ一覧'),
    makeTable(
      ['列', '内容'],
      [
        ['氏名', 'スタッフ名と肩書'],
        ['雇用形態', '正社員 / パート'],
        ['給与形態', '月給制 / 時給制'],
        ['時給・基本給', '時給額または月給額'],
        ['状態', '有効（緑）/ 無効（灰）'],
        ['操作', '編集・URL共有・無効化ボタン'],
      ]
    ),
    h2('新規スタッフ登録'),
    p('「新規登録」ボタンを押すと登録フォームが開きます。'),
    h3('基本情報'),
    makeTable(['項目', '必須', '説明'], [
      ['氏名', '○', 'フルネーム'],
      ['肩書', '', '役職名など'],
    ]),
    h3('雇用・給与'),
    makeTable(['項目', '説明'], [
      ['雇用形態', '正社員 / パート'],
      ['給与形態', '月給制 / 時給制'],
      ['基本給', '月給制の場合の月額'],
      ['時給', '時給制の場合の時給額。月給制でも残業計算用の時間単価を設定'],
    ]),
    h3('税・保険'),
    makeTable(['項目', '説明'], [
      ['税区分', '甲欄（メインの職場）/ 乙欄（副業）'],
      ['雇用保険', '対象の場合チェック（支給総額 × 0.5%）'],
      ['健康保険料', '月額固定額'],
      ['介護保険料', '月額固定額'],
      ['厚生年金', '月額固定額'],
    ]),
    h3('控除・手当'),
    makeTable(['項目', '説明'], [
      ['食事代控除', '対象の場合チェック（1食 ¥125 × 食数）'],
      ['交通費支給', '対象の場合チェック（出勤日 × ¥500）'],
      ['家賃控除', '月額固定額'],
    ]),
    h3('従業員ページ'),
    p('スタッフ登録後、従業員ページURLが自動生成されます。スタッフ編集画面からURL共有が可能です。'),
    emptyLine(),
  );

  // 第7章: 勤怠管理
  sections.push(
    h1('7. 勤怠管理'),
    p([{ text: 'URL: ', bold: true }, { text: '/admin/attendance' }]),
    h2('フィルタ'),
    bulletItem('年月: 月単位で表示を切り替え'),
    bulletItem('スタッフ: 全員表示 / 個別スタッフ表示'),
    h2('勤怠一覧テーブル'),
    makeTable(['列', '内容'], [
      ['日付', '日付（修正がある場合「*修正あり」と表示）'],
      ['スタッフ', 'スタッフ名（全員表示時）'],
      ['出勤', '出勤時刻'],
      ['退勤', '退勤時刻'],
      ['休憩', '休憩時間の合計'],
      ['実労働', '実際の労働時間（休憩除く）'],
      ['操作', '詳細表示ボタン'],
    ]),
    h2('打刻記録の詳細・編集'),
    p('「詳細」ボタンを押すと、その日の全打刻記録が展開表示されます。'),
    h3('記録の編集'),
    bulletItem('打刻記録の「編集」ボタンをクリック'),
    bulletItem('日時を修正して「保存」をクリック'),
    h3('記録の削除'),
    bulletItem('打刻記録の「削除」ボタンをクリック'),
    bulletItem('確認ダイアログで「OK」'),
    h3('記録の追加'),
    bulletItem('「打刻を追加」ボタンをクリック'),
    bulletItem('記録種別（出勤/退勤/休憩開始/休憩終了）を選択'),
    bulletItem('日時を入力して「追加」をクリック'),
    note('管理者が修正・追加した記録には「修正済み」マークが付きます。'),
    emptyLine(),
  );

  // 第8章: 給与計算
  sections.push(
    h1('8. 給与計算'),
    p([{ text: 'URL: ', bold: true }, { text: '/admin/payroll' }]),
    p('3つのタブで構成されています。'),
    h2('月次設定タブ'),
    h3('所定労働日数'),
    p('その月の所定労働日数を入力します（デフォルト: 22日）。月給制スタッフの欠勤控除計算に使用します。'),
    h3('まかない・食事代'),
    makeTable(['項目', '説明'], [
      ['まかない食数', 'まかない手当の対象食数（¥125 × 食数を支給）'],
      ['食事代控除食数', '食事代控除の対象食数（¥125 × 食数を控除）'],
      ['備考', '任意のメモ'],
    ]),
    h2('計算結果タブ'),
    p('「給与計算実行」ボタンで全有効スタッフの給与が一括計算されます。'),
    makeTable(['列', '内容'], [
      ['スタッフ', '氏名'],
      ['労働日数', '実際に出勤した日数'],
      ['支給総額', '各種手当込みの総額'],
      ['控除総額', '税・保険等の控除合計'],
      ['差引支給額', '実際の支払額'],
    ]),
    h2('給与明細詳細'),
    p('「明細」ボタンで個別の給与明細を表示します。勤怠・支給・控除の内訳、差引支給額、紙幣・硬貨内訳が確認できます。'),
    emptyLine(),
  );

  // 第9章: 帳票出力
  sections.push(
    h1('9. 帳票出力'),
    p([{ text: 'URL: ', bold: true }, { text: '/admin/reports' }]),
    makeTable(['帳票', '形式', '説明'], [
      ['月次勤怠一覧表', 'PDF / CSV', '全スタッフの日別出退勤時刻一覧'],
      ['給与一覧', 'PDF / CSV', '全スタッフの支給・控除・手取りの一覧'],
      ['現金封入用一覧', 'PDF', 'スタッフ名・手取額・紙幣硬貨内訳'],
      ['給与明細（全員）', 'PDF', '全スタッフの給与明細を一括出力'],
      ['給与明細（個別）', 'PDF', '指定スタッフの給与明細のみ出力'],
    ]),
    emptyLine(),
  );

  // 第10章: 従業員ページ
  sections.push(
    h1('10. 従業員ページ'),
    p([{ text: 'URL: ', bold: true }, { text: '/employee/:token（スタッフごとに固有のURL）' }]),
    h2('ログイン'),
    bulletItem('管理者から共有されたURLにアクセス'),
    bulletItem('パスワードを入力して「ログイン」'),
    h2('勤務履歴タブ'),
    bulletItem('当月労働日数・合計労働時間のサマリーカード'),
    bulletItem('月間タイムラインで勤務状況を視覚表示'),
    bulletItem('日別の出退勤・休憩・実労働時間の一覧'),
    h2('給与情報タブ'),
    bulletItem('当月の支給総額・控除総額・差引支給額'),
    bulletItem('過去の給与明細一覧（年月・区分・支給・控除・手取り）'),
    emptyLine(),
  );

  // 第11章: 毎月の運用フロー
  sections.push(
    h1('11. 毎月の運用フロー'),
    h2('日常業務'),
    bulletItem('打刻: スタッフが /punch ページで出退勤を打刻'),
    bulletItem('確認: 管理者がダッシュボードで出勤状況を確認'),
    h2('月末〜翌月初の給与処理'),
    p([{ text: '① 勤怠確認・修正', bold: true }]),
    p('勤怠管理ページで打刻漏れや誤りを修正します。', { indent: { left: 360 } }),
    p([{ text: '② 月次設定', bold: true }]),
    p('給与計算 → 月次設定タブで所定労働日数・まかない食数を入力します。', { indent: { left: 360 } }),
    p([{ text: '③ 給与計算実行', bold: true }]),
    p('給与計算 → 計算結果タブで「給与計算実行」ボタンを押します。', { indent: { left: 360 } }),
    p([{ text: '④ 結果確認', bold: true }]),
    p('各スタッフの給与明細詳細を確認します。', { indent: { left: 360 } }),
    p([{ text: '⑤ 帳票出力', bold: true }]),
    p('帳票出力ページで必要な帳票を印刷します。', { indent: { left: 360 } }),
    p([{ text: '⑥ 給与支払い', bold: true }]),
    p('現金封入用一覧の内訳に従い封筒を準備・配布します。', { indent: { left: 360 } }),
    emptyLine(),
  );

  // 第12章: 給与計算ルール詳細
  sections.push(
    h1('12. 給与計算ルール詳細'),
    h2('労働時間の分類'),
    makeTable(['区分', '条件', '割増率'], [
      ['通常', '1日8時間以内', '1.0倍'],
      ['残業', '1日8時間超過分', '1.25倍'],
      ['深夜', '22:00〜翌5:00の勤務', '1.25倍'],
      ['休日', '週6日目以降の勤務', '1.25倍'],
    ]),
    note('残業と深夜が重複する場合も1.25倍（加算して1.5倍にはなりません）'),
    h2('週の起算日'),
    p('水曜日起算（水曜〜火曜を1週間とする）。週の中で6日目以降の勤務日が「休日勤務」として扱われます。'),
    h2('時給制スタッフの計算'),
    p('通常賃金 = 時給 × 通常時間（分） ÷ 60'),
    p('残業手当 = 時給 × 1.25 × 残業時間（分） ÷ 60'),
    p('深夜手当 = 時給 × 1.25 × 深夜時間（分） ÷ 60'),
    p('休日手当 = 時給 × 1.25 × 休日時間（分） ÷ 60'),
    h2('月給制スタッフの計算'),
    p('基本給 = 月額基本給（固定）'),
    p('欠勤がある場合: 日割り額 = 基本給 ÷ 所定労働日数 → 基本給 − 日割り額 × 欠勤日数'),
    p('残業・深夜・休日手当は時間単価ベースで計算（時給制と同様の計算式）'),
    h2('手当'),
    makeTable(['種類', '計算方法'], [
      ['交通費', '出勤日数 × ¥500'],
      ['まかない手当', 'まかない食数 × ¥125'],
    ]),
    h2('控除'),
    makeTable(['種類', '計算方法'], [
      ['所得税', '令和7年源泉徴収税額表（甲欄/乙欄）による'],
      ['健康保険料', '月額固定（スタッフ設定値）'],
      ['介護保険料', '月額固定（スタッフ設定値）'],
      ['厚生年金', '月額固定（スタッフ設定値）'],
      ['雇用保険料', '支給総額 × 0.5%（端数切り捨て）'],
      ['食事代', '食事代控除食数 × ¥125'],
      ['家賃', '月額固定（スタッフ設定値）'],
    ]),
    h2('所得税の計算対象額'),
    p('課税対象額 = 支給総額 − 交通費 − 社会保険料合計'),
    p('社会保険料 = 健康保険 + 介護保険 + 厚生年金 + 雇用保険'),
    emptyLine(),
    p([{ text: '本マニュアルは2026年3月時点の内容です。', italics: true, color: GRAY, size: 10 }]),
  );

  return new Document({
    styles: defaultStyles,
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          pageNumbers: { start: 1 },
        },
      },
      headers: { default: makeHeader('てんから勤怠システム 操作マニュアル') },
      footers: { default: makeFooter() },
      children: sections,
    }],
  });
}

// ========================================
// 仕様一覧生成
// ========================================
function generateSpec() {
  const date = '2026年3月';
  const sections = [];

  // 表紙
  sections.push(...coverPage(
    'てんから勤怠システム',
    '計算式・仕様一覧',
    date
  ));

  // 目次
  sections.push(
    h1('目次'),
    p(''),
    ...[
      '1. この資料について',
      '2. 勤務時間のルール',
      '3. 給与の計算方法',
      '4. 手当の一覧',
      '5. 控除の一覧',
      '6. 差引支給額の求め方',
      '7. 紙幣・硬貨内訳の仕組み',
      '8. 計算例',
    ].map(item => p(item, { size: 12 })),
    pageBreak(),
  );

  // 第1章: この資料について
  sections.push(
    h1('1. この資料について'),
    p('この資料は、てんから勤怠システムがどのように勤務時間の集計や給与の計算を行っているかを、会計の知識がない方にもわかりやすく説明するものです。'),
    p('「なぜこの計算になるのか」という理由も含めて解説しています。計算に疑問を感じたときに参照してください。'),
    emptyLine(),
  );

  // 第2章: 勤務時間のルール
  sections.push(
    h1('2. 勤務時間のルール'),
    p('勤務時間は法律（労働基準法）のルールに基づき、4つの区分に分けて管理しています。'),

    h2('2-1. 通常と残業の境目（1日8時間ルール）'),
    p([
      { text: '法律では、1日の労働時間は原則8時間までとされています。', bold: false },
    ]),
    p('8時間を超えた分は「残業」となり、通常の時給より割増された金額で支払う必要があります。'),
    emptyLine(),
    p([{ text: '【例】', bold: true }]),
    p('9:00に出勤し、12:00〜13:00に1時間休憩をとり、19:00に退勤した場合:'),
    bulletItem('実労働時間 = 9時間（10時間 − 休憩1時間）'),
    bulletItem('通常時間 = 8時間'),
    bulletItem('残業時間 = 1時間（9時間 − 8時間）'),
    emptyLine(),
    note('このシステムでは、残業は1日単位で判定します。「今週たくさん働いたから残業」ではなく、「今日8時間を超えたから残業」です。'),

    h2('2-2. 深夜帯とは'),
    p([
      { text: '深夜帯は 22:00〜翌朝5:00 ', bold: true },
      { text: 'の時間帯を指します。' },
    ]),
    p('この時間帯に勤務すると、通常の時給に加えて25%の割増が付きます。これは法律で決められた「深夜労働割増」です。'),
    emptyLine(),
    p([{ text: '【例】', bold: true }]),
    p('17:00〜24:00（0:00）に勤務した場合（休憩なし）:'),
    bulletItem('通常時間帯の勤務 = 17:00〜22:00 = 5時間'),
    bulletItem('深夜帯の勤務 = 22:00〜24:00 = 2時間'),
    bulletItem('合計7時間のうち、深夜2時間分には割増が付く'),
    emptyLine(),
    note('深夜割増は「通常の時給の1.25倍」です。残業と深夜が重なった場合でも、このシステムでは1.25倍で計算します（1.5倍にはなりません）。'),

    h2('2-3. 休日勤務の判定'),
    p([
      { text: 'このシステムでは、週の起算日を水曜日', bold: true },
      { text: 'としています。' },
    ]),
    p('つまり「水曜日〜翌週火曜日」を1週間とし、その週の中で6日目以降に出勤した日が「休日勤務」になります。'),
    emptyLine(),
    p([{ text: '【具体例】', bold: true }]),
    p('ある週（水〜火）に毎日出勤した場合:'),
    makeTable(
      ['日', '曜日', '出勤日数目', '扱い'],
      [
        ['水', '水曜', '1日目', '通常勤務'],
        ['木', '木曜', '2日目', '通常勤務'],
        ['金', '金曜', '3日目', '通常勤務'],
        ['土', '土曜', '4日目', '通常勤務'],
        ['日', '日曜', '5日目', '通常勤務'],
        ['月', '月曜', '6日目', '休日勤務（25%割増）'],
        ['火', '火曜', '7日目', '休日勤務（25%割増）'],
      ]
    ),
    emptyLine(),
    note('飲食店は一般企業と休日パターンが異なるため、水曜起算としています。'),

    h2('2-4. 割増が重なった場合'),
    p('残業（8時間超）と深夜（22時以降）が同時に発生することがあります。'),
    p('このシステムでは、重複した場合も割増率は1.25倍のままです。法定では1.5倍となるケースもありますが、このシステムの運用上はそれぞれ1.25倍で計算しています。'),
    emptyLine(),
    makeTable(
      ['状況', 'このシステムでの割増率'],
      [
        ['通常時間帯 + 8時間以内', '1.0倍（割増なし）'],
        ['通常時間帯 + 8時間超（残業）', '1.25倍'],
        ['深夜帯（22:00以降）', '1.25倍'],
        ['深夜帯 + 残業（重複）', '1.25倍'],
        ['休日勤務', '1.25倍'],
      ]
    ),
    emptyLine(),
  );

  // 第3章: 給与の計算方法
  sections.push(
    h1('3. 給与の計算方法'),
    p('スタッフの給与は「時給制」と「月給制」の2種類があり、それぞれ計算方法が異なります。'),

    h2('3-1. 時給制の計算'),
    p('時給制は、働いた時間に時給をかけてそのまま計算します。一番わかりやすい方法です。'),
    emptyLine(),
    makeTable(
      ['区分', '計算式'],
      [
        ['通常賃金', '時給 × 通常時間（分） ÷ 60'],
        ['残業手当', '時給 × 1.25 × 残業時間（分） ÷ 60'],
        ['深夜手当', '時給 × 1.25 × 深夜時間（分） ÷ 60'],
        ['休日手当', '時給 × 1.25 × 休日時間（分） ÷ 60'],
      ]
    ),
    emptyLine(),
    p([{ text: '【計算のポイント】', bold: true }]),
    bulletItem('時間は「分」単位で集計し、最後に60で割ります'),
    bulletItem('計算結果の端数は1円未満を切り捨てます'),
    bulletItem('深夜手当は、深夜帯に働いた時間に対する「追加分」です'),

    h2('3-2. 月給制の計算'),
    p('月給制は、毎月決まった基本給を支給します。ただし、欠勤があった場合は日割りで差し引きます。'),
    emptyLine(),
    p([{ text: '基本給の計算:', bold: true }]),
    p('通常: 基本給 = 月額基本給（そのまま）'),
    p('欠勤がある場合:'),
    bulletItem('日割り額 = 月額基本給 ÷ 所定労働日数'),
    bulletItem('基本給 = 月額基本給 − 日割り額 × 欠勤日数'),
    emptyLine(),
    p([{ text: '欠勤日数の求め方:', bold: true }]),
    p('欠勤日数 = 所定労働日数 − 実際の出勤日数'),
    note('「所定労働日数」とは、その月に出勤すべき日数のことで、月次設定で管理者が入力します（デフォルト22日）。'),
    emptyLine(),
    p([{ text: '残業・深夜・休日手当:', bold: true }]),
    p('月給制でも、残業・深夜・休日手当は時給制と同様に「時間単価」ベースで計算します。'),
    p('時間単価はスタッフ登録時に設定する「時給（残業計算用）」の値を使用します。'),
    emptyLine(),
  );

  // 第4章: 手当の一覧
  sections.push(
    h1('4. 手当の一覧'),
    p('基本給・残業手当以外に、以下の手当があります。'),
    emptyLine(),

    h2('4-1. 交通費'),
    makeTable(
      ['項目', '内容'],
      [
        ['対象', '「交通費支給」にチェックがあるスタッフ'],
        ['計算式', '出勤日数 × ¥500'],
        ['例', '月に20日出勤した場合: 20 × 500 = ¥10,000'],
      ]
    ),
    emptyLine(),
    p('交通費は非課税のため、所得税の計算対象から除外されます。'),

    h2('4-2. まかない手当'),
    makeTable(
      ['項目', '内容'],
      [
        ['対象', '月次設定で「まかない食数」が入力されたスタッフ'],
        ['計算式', 'まかない食数 × ¥125'],
        ['例', '月に15食の場合: 15 × 125 = ¥1,875'],
      ]
    ),
    emptyLine(),
    p('まかない手当は、従業員の食事に対する補助です。管理者が月ごとに食数を入力します。'),
    emptyLine(),
  );

  // 第5章: 控除の一覧
  sections.push(
    h1('5. 控除の一覧'),
    p('「控除」とは、支給額から差し引かれるもののことです。税金や保険料、その他天引きされるものが含まれます。'),

    h2('5-1. 社会保険料とは'),
    p('社会保険料は、病気やケガ、老後の生活を支えるための公的な保険制度の掛け金です。従業員と事業主が折半して負担します。'),
    emptyLine(),
    makeTable(
      ['保険の種類', '何のための保険か', '計算方法'],
      [
        ['健康保険', '病気・ケガの治療費を補助', '月額固定（スタッフ設定値）'],
        ['介護保険', '介護サービスの費用を補助（40歳以上）', '月額固定（スタッフ設定値）'],
        ['厚生年金', '老後の年金を積み立て', '月額固定（スタッフ設定値）'],
        ['雇用保険', '失業時の給付など', '支給総額 × 0.5%（端数切り捨て）'],
      ]
    ),
    emptyLine(),
    note('健康保険・介護保険・厚生年金は、標準報酬月額に基づく金額をスタッフ登録時に設定します。雇用保険のみ毎月の支給額に応じて変動します。'),

    h2('5-2. 所得税とは'),
    p('所得税は、給与に対して国に納める税金です。事業主が従業員の給与から天引きし、代わりに納付します（源泉徴収）。'),
    emptyLine(),
    p([{ text: '甲欄と乙欄の違い:', bold: true }]),
    makeTable(
      ['区分', '意味', '税額'],
      [
        ['甲欄', 'この職場がメイン（扶養控除等申告書を提出済み）', '低い'],
        ['乙欄', '副業として働いている（申告書の提出なし）', '高い'],
      ]
    ),
    emptyLine(),
    p([{ text: '計算対象額（課税対象額）の求め方:', bold: true }]),
    p('課税対象額 = 支給総額 − 交通費 − 社会保険料合計'),
    emptyLine(),
    p('この課税対象額を「源泉徴収税額表（令和7年）」に照らし合わせて、所得税額が決まります。'),
    note('交通費は非課税のため差し引きます。社会保険料も控除後の金額に対して課税されるため差し引きます。'),

    h2('5-3. その他の控除'),
    makeTable(
      ['控除の種類', '内容', '計算方法'],
      [
        ['食事代', '従業員の食事代を給与から天引き', '食事代控除食数 × ¥125'],
        ['家賃', '社宅・寮の家賃を給与から天引き', '月額固定（スタッフ設定値）'],
      ]
    ),
    emptyLine(),
  );

  // 第6章: 差引支給額の求め方
  sections.push(
    h1('6. 差引支給額の求め方'),
    p('差引支給額（手取り額）は、支給額合計から控除額合計を引いた金額です。全体の計算フローは以下の通りです。'),
    emptyLine(),

    p([{ text: '【ステップ1】勤怠を集計する', bold: true, size: 12, color: DARK_BLUE }]),
    bulletItem('月間の出勤日数、通常/残業/深夜/休日の各時間を集計'),
    emptyLine(),

    p([{ text: '【ステップ2】基本給を計算する', bold: true, size: 12, color: DARK_BLUE }]),
    bulletItem('時給制: 時給 × 通常時間'),
    bulletItem('月給制: 月額基本給（欠勤があれば日割り控除）'),
    emptyLine(),

    p([{ text: '【ステップ3】割増手当を計算する', bold: true, size: 12, color: DARK_BLUE }]),
    bulletItem('残業手当 = 時間単価 × 1.25 × 残業時間'),
    bulletItem('深夜手当 = 時間単価 × 1.25 × 深夜時間'),
    bulletItem('休日手当 = 時間単価 × 1.25 × 休日時間'),
    emptyLine(),

    p([{ text: '【ステップ4】その他手当を加算する', bold: true, size: 12, color: DARK_BLUE }]),
    bulletItem('交通費、まかない手当'),
    emptyLine(),

    p([{ text: '【ステップ5】支給額合計を求める', bold: true, size: 12, color: DARK_BLUE }]),
    p('支給額合計 = 基本給 + 残業手当 + 深夜手当 + 休日手当 + 交通費 + まかない手当'),
    emptyLine(),

    p([{ text: '【ステップ6】控除額を計算する', bold: true, size: 12, color: DARK_BLUE }]),
    bulletItem('社会保険料（健康保険 + 介護保険 + 厚生年金 + 雇用保険）'),
    bulletItem('所得税（源泉徴収税額表から算出）'),
    bulletItem('食事代、家賃'),
    emptyLine(),

    p([{ text: '【ステップ7】差引支給額を求める', bold: true, size: 12, color: DARK_BLUE }]),
    p([
      { text: '差引支給額 = 支給額合計 − 控除額合計', bold: true, size: 13, color: DARK_BLUE },
    ]),
    emptyLine(),
  );

  // 第7章: 紙幣・硬貨内訳の仕組み
  sections.push(
    h1('7. 紙幣・硬貨内訳の仕組み'),
    p('現金手渡しで給与を支払う際に、どの紙幣・硬貨が何枚必要かを自動計算します。'),
    emptyLine(),
    p([{ text: '計算方法:', bold: true }]),
    p('差引支給額を大きい額面から順に割り当てます。'),
    emptyLine(),
    makeTable(
      ['額面', '種類'],
      [
        ['¥10,000', '一万円札'],
        ['¥5,000', '五千円札'],
        ['¥1,000', '千円札'],
        ['¥500', '500円玉'],
        ['¥100', '100円玉'],
        ['¥50', '50円玉'],
        ['¥10', '10円玉'],
        ['¥5', '5円玉'],
        ['¥1', '1円玉'],
      ]
    ),
    emptyLine(),
    p([{ text: '【例】差引支給額が ¥37,825 の場合:', bold: true }]),
    bulletItem('一万円札: 3枚（¥30,000）'),
    bulletItem('五千円札: 1枚（¥5,000）'),
    bulletItem('千円札: 2枚（¥2,000）'),
    bulletItem('500円玉: 1枚（¥500）'),
    bulletItem('100円玉: 3枚（¥300）'),
    bulletItem('10円玉: 2枚（¥20）'),
    bulletItem('5円玉: 1枚（¥5）'),
    emptyLine(),
  );

  // 第8章: 計算例
  sections.push(
    h1('8. 計算例'),
    p('実際の数値を使って、最初から最後まで計算してみましょう。'),

    h2('8-1. 時給制スタッフの計算例'),
    emptyLine(),
    p([{ text: '前提条件:', bold: true }]),
    makeTable(
      ['項目', '値'],
      [
        ['氏名', '山田太郎'],
        ['雇用形態', 'パート・時給制'],
        ['時給', '¥1,100'],
        ['税区分', '甲欄'],
        ['交通費', 'あり'],
        ['食事代控除', 'あり'],
        ['雇用保険', 'あり'],
        ['社会保険', 'なし（加入なし）'],
      ]
    ),
    emptyLine(),
    p([{ text: '当月の勤怠実績:', bold: true }]),
    makeTable(
      ['項目', '値'],
      [
        ['出勤日数', '20日'],
        ['通常時間', '9,000分（150時間）'],
        ['残業時間', '600分（10時間）'],
        ['深夜時間', '120分（2時間）'],
        ['休日時間', '0分'],
        ['まかない食数', '18食'],
        ['食事代控除食数', '10食'],
      ]
    ),
    emptyLine(),
    p([{ text: 'ステップ1: 基本給', bold: true }]),
    p('通常賃金 = 1,100 × 9,000 ÷ 60 = ¥165,000'),
    emptyLine(),
    p([{ text: 'ステップ2: 割増手当', bold: true }]),
    p('残業手当 = 1,100 × 1.25 × 600 ÷ 60 = ¥13,750'),
    p('深夜手当 = 1,100 × 1.25 × 120 ÷ 60 = ¥2,750'),
    emptyLine(),
    p([{ text: 'ステップ3: その他手当', bold: true }]),
    p('交通費 = 20日 × 500 = ¥10,000'),
    p('まかない手当 = 18食 × 125 = ¥2,250'),
    emptyLine(),
    p([{ text: 'ステップ4: 支給額合計', bold: true }]),
    p('¥165,000 + ¥13,750 + ¥2,750 + ¥10,000 + ¥2,250 = ¥193,750'),
    emptyLine(),
    p([{ text: 'ステップ5: 控除', bold: true }]),
    p('雇用保険 = 193,750 × 0.5% = ¥968（端数切り捨て）'),
    p('課税対象額 = 193,750 − 10,000（交通費）− 968（雇用保険）= ¥182,782'),
    p('所得税 = 税額表から算出（甲欄・扶養0人の場合）→ 約 ¥3,770'),
    p('食事代 = 10食 × 125 = ¥1,250'),
    p('控除合計 = 968 + 3,770 + 1,250 = ¥5,988'),
    emptyLine(),
    p([{ text: 'ステップ6: 差引支給額', bold: true, size: 12, color: DARK_BLUE }]),
    p([{ text: '¥193,750 − ¥5,988 = ¥187,762', bold: true, size: 13, color: DARK_BLUE }]),
    emptyLine(),

    h2('8-2. 月給制スタッフの計算例'),
    emptyLine(),
    p([{ text: '前提条件:', bold: true }]),
    makeTable(
      ['項目', '値'],
      [
        ['氏名', '佐藤花子'],
        ['雇用形態', '正社員・月給制'],
        ['基本給（月額）', '¥250,000'],
        ['時給（残業計算用）', '¥1,500'],
        ['税区分', '甲欄'],
        ['交通費', 'あり'],
        ['雇用保険', 'あり'],
        ['健康保険', '¥12,000/月'],
        ['厚生年金', '¥23,000/月'],
        ['家賃控除', '¥20,000/月'],
      ]
    ),
    emptyLine(),
    p([{ text: '当月の勤怠実績:', bold: true }]),
    makeTable(
      ['項目', '値'],
      [
        ['所定労働日数', '22日'],
        ['出勤日数', '21日（1日欠勤）'],
        ['残業時間', '900分（15時間）'],
        ['深夜時間', '180分（3時間）'],
        ['休日時間', '480分（8時間）'],
      ]
    ),
    emptyLine(),
    p([{ text: 'ステップ1: 基本給（欠勤控除あり）', bold: true }]),
    p('日割り額 = 250,000 ÷ 22 = ¥11,363（端数切り捨て）'),
    p('基本給 = 250,000 − 11,363 × 1 = ¥238,637'),
    emptyLine(),
    p([{ text: 'ステップ2: 割増手当', bold: true }]),
    p('残業手当 = 1,500 × 1.25 × 900 ÷ 60 = ¥28,125'),
    p('深夜手当 = 1,500 × 1.25 × 180 ÷ 60 = ¥5,625'),
    p('休日手当 = 1,500 × 1.25 × 480 ÷ 60 = ¥15,000'),
    emptyLine(),
    p([{ text: 'ステップ3: その他手当', bold: true }]),
    p('交通費 = 21日 × 500 = ¥10,500'),
    emptyLine(),
    p([{ text: 'ステップ4: 支給額合計', bold: true }]),
    p('¥238,637 + ¥28,125 + ¥5,625 + ¥15,000 + ¥10,500 = ¥297,887'),
    emptyLine(),
    p([{ text: 'ステップ5: 控除', bold: true }]),
    p('健康保険 = ¥12,000'),
    p('厚生年金 = ¥23,000'),
    p('雇用保険 = 297,887 × 0.5% = ¥1,489（端数切り捨て）'),
    p('社会保険合計 = 12,000 + 23,000 + 1,489 = ¥36,489'),
    p('課税対象額 = 297,887 − 10,500（交通費）− 36,489（社保）= ¥250,898'),
    p('所得税 = 税額表から算出（甲欄・扶養0人の場合）→ 約 ¥7,410'),
    p('家賃 = ¥20,000'),
    p('控除合計 = 36,489 + 7,410 + 20,000 = ¥63,899'),
    emptyLine(),
    p([{ text: 'ステップ6: 差引支給額', bold: true, size: 12, color: DARK_BLUE }]),
    p([{ text: '¥297,887 − ¥63,899 = ¥233,988', bold: true, size: 13, color: DARK_BLUE }]),
    emptyLine(),
    emptyLine(),
    p([{ text: '本資料は2026年3月時点の内容です。', italics: true, color: GRAY, size: 10 }]),
  );

  return new Document({
    styles: defaultStyles,
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          pageNumbers: { start: 1 },
        },
      },
      headers: { default: makeHeader('てんから勤怠システム 計算式・仕様一覧') },
      footers: { default: makeFooter() },
      children: sections,
    }],
  });
}

// ========================================
// メイン実行
// ========================================
async function main() {
  console.log('Word文書を生成しています...');

  const manualDoc = generateManual();
  const manualBuf = await Packer.toBuffer(manualDoc);
  const manualPath = path.join(__dirname, 'てんから勤怠システム_操作マニュアル.docx');
  fs.writeFileSync(manualPath, manualBuf);
  console.log(`✓ ${manualPath}`);

  const specDoc = generateSpec();
  const specBuf = await Packer.toBuffer(specDoc);
  const specPath = path.join(__dirname, 'てんから勤怠システム_仕様一覧.docx');
  fs.writeFileSync(specPath, specBuf);
  console.log(`✓ ${specPath}`);

  console.log('完了しました。');
}

main().catch(console.error);
