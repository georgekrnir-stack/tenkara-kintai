-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time');

-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('monthly', 'hourly');

-- CreateEnum
CREATE TYPE "TaxColumn" AS ENUM ('kou', 'otsu');

-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end');

-- CreateTable
CREATE TABLE "staffs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "employment_type" "EmploymentType" NOT NULL,
    "salary_type" "SalaryType" NOT NULL,
    "monthly_salary" INTEGER,
    "hourly_rate" INTEGER,
    "tax_column" "TaxColumn" NOT NULL,
    "has_employment_insurance" BOOLEAN NOT NULL DEFAULT false,
    "health_insurance_amount" INTEGER NOT NULL DEFAULT 0,
    "care_insurance_amount" INTEGER NOT NULL DEFAULT 0,
    "pension_amount" INTEGER NOT NULL DEFAULT 0,
    "has_meal_deduction" BOOLEAN NOT NULL DEFAULT false,
    "rent_deduction" INTEGER NOT NULL DEFAULT 0,
    "has_transport_allowance" BOOLEAN NOT NULL DEFAULT false,
    "employee_url_token" VARCHAR(64) NOT NULL,
    "employee_password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_records" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "record_type" "RecordType" NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "is_modified" BOOLEAN NOT NULL DEFAULT false,
    "modified_by" TEXT,
    "modified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_extra_inputs" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "meal_count" INTEGER NOT NULL DEFAULT 0,
    "meal_deduction_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "monthly_extra_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "work_days" INTEGER NOT NULL,
    "total_work_minutes" INTEGER NOT NULL,
    "normal_work_minutes" INTEGER NOT NULL,
    "overtime_minutes" INTEGER NOT NULL,
    "night_work_minutes" INTEGER NOT NULL,
    "holiday_work_minutes" INTEGER NOT NULL,
    "base_pay" INTEGER NOT NULL,
    "overtime_pay" INTEGER NOT NULL,
    "night_pay" INTEGER NOT NULL,
    "holiday_pay" INTEGER NOT NULL,
    "transport_allowance" INTEGER NOT NULL,
    "meal_allowance" INTEGER NOT NULL,
    "gross_pay" INTEGER NOT NULL,
    "income_tax" INTEGER NOT NULL,
    "health_insurance" INTEGER NOT NULL,
    "care_insurance" INTEGER NOT NULL,
    "pension" INTEGER NOT NULL,
    "employment_insurance" INTEGER NOT NULL,
    "meal_deduction" INTEGER NOT NULL,
    "rent_deduction" INTEGER NOT NULL,
    "total_deduction" INTEGER NOT NULL,
    "net_pay" INTEGER NOT NULL,
    "is_bonus" BOOLEAN NOT NULL DEFAULT false,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staffs_employee_url_token_key" ON "staffs"("employee_url_token");

-- CreateIndex
CREATE INDEX "time_records_staff_id_recorded_at_idx" ON "time_records"("staff_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_extra_inputs_staff_id_year_month_key" ON "monthly_extra_inputs"("staff_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_staff_id_year_month_is_bonus_key" ON "payroll_records"("staff_id", "year_month", "is_bonus");

-- CreateIndex
CREATE UNIQUE INDEX "admin_settings_key_key" ON "admin_settings"("key");

-- AddForeignKey
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_extra_inputs" ADD CONSTRAINT "monthly_extra_inputs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
