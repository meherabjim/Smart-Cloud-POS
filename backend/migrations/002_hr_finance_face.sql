-- =========================================================
-- Migration 002: HR, finance and face attendance
-- Target: pos_db on TiDB Cloud (MySQL compatible)
--
-- Adds: attendance, expenses, suppliers, supplier_transactions,
--       salary_payments tables, plus salary / face columns on users.
--
-- Safe to re-run: tables use IF NOT EXISTS. The ALTER TABLE lines
-- fail with "Duplicate column" if the column already exists; that
-- error can be ignored.
--
-- TiDB Cloud SQL Editor tip: the Run button only executes the
-- statement under the cursor. Select everything (Ctrl+A) first,
-- then press Run, to execute the whole file.
-- =========================================================

-- Staff attendance: one row per user per day
CREATE TABLE IF NOT EXISTS attendance (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  store_id INT DEFAULT NULL,
  date DATE NOT NULL,
  status ENUM('Present','Late','Absent','Leave') NOT NULL DEFAULT 'Present',
  check_in_time TIME DEFAULT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_date (user_id, date)
);

-- Store expenses (rent, bills, salary payouts).
-- source = 'Manual' | 'Salary' (salary rows are created automatically)
CREATE TABLE IF NOT EXISTS expenses (
  id INT NOT NULL AUTO_INCREMENT,
  store_id INT DEFAULT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note VARCHAR(255) DEFAULT NULL,
  expense_date DATE NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'Manual',
  ref_id INT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Suppliers with a running due balance
CREATE TABLE IF NOT EXISTS suppliers (
  id INT NOT NULL AUTO_INCREMENT,
  store_id INT DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  due_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Supplier ledger: DUE raises the balance, PAYMENT lowers it
CREATE TABLE IF NOT EXISTS supplier_transactions (
  id INT NOT NULL AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  store_id INT DEFAULT NULL,
  type ENUM('DUE','PAYMENT') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Monthly salary payments: one row per user per month
CREATE TABLE IF NOT EXISTS salary_payments (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  store_id INT DEFAULT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  base_salary DECIMAL(10,2) NOT NULL,
  absent_days INT NOT NULL DEFAULT 0,
  late_days INT NOT NULL DEFAULT 0,
  absent_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  late_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  net_paid DECIMAL(10,2) NOT NULL,
  paid_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_month (user_id, year, month)
);

-- Staff monthly salary
ALTER TABLE users ADD COLUMN salary DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Face attendance. Only a numeric face embedding (face_descriptor)
-- is stored, never the photo itself.
ALTER TABLE users ADD COLUMN face_registered TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN face_image VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN face_descriptor MEDIUMTEXT NULL;
