import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const taxTable = JSON.parse(
  readFileSync(path.join(__dirname, '../data/tax-table-r7.json'), 'utf-8')
);

/**
 * 所得税を計算
 * @param taxableAmount - 課税対象額（円）
 * @param column - 'kou' | 'otsu'
 * @returns 所得税額（円）
 */
export function calcIncomeTax(taxableAmount, column) {
  const table = taxTable[column];
  if (!table) return 0;

  taxableAmount = Math.max(0, Math.floor(taxableAmount));

  for (const row of table) {
    if (taxableAmount >= row.min && taxableAmount < row.max) {
      if (row.tax !== undefined) {
        return row.tax;
      }
      // 乙欄の高額帯: 計算式
      if (row.tax_rate !== undefined) {
        if (row.base !== undefined) {
          return Math.floor(row.base + (taxableAmount - row.base_amount) * row.tax_rate);
        }
        return Math.floor(taxableAmount * row.tax_rate);
      }
    }
  }

  // テーブルの最後のエントリを返す
  const last = table[table.length - 1];
  if (last.tax !== undefined) return last.tax;
  return 0;
}
