-- =========================================================
-- Migration 001: Customer loyalty portal
-- Run after database_structure.sql, which does not include
-- the loyalty tables.
--
-- Adds: customers, point_transactions, and loyalty columns on sales.
-- ALTER TABLE lines fail with "Duplicate column" if the column
-- already exists; that error can be ignored.
-- =========================================================

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(190) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  points_balance INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_customer_phone (phone),
  UNIQUE KEY uniq_customer_email (email)
);

-- Points ledger. EARN: 1 point per ৳100 spent.
-- REDEEM: 100 points = ৳80 discount.
CREATE TABLE IF NOT EXISTS point_transactions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  sale_id INT DEFAULT NULL,
  store_id INT DEFAULT NULL,
  transaction_type ENUM('EARN','REDEEM') NOT NULL,
  points INT NOT NULL,
  amount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  balance_after INT NOT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pt_customer (customer_id)
);

ALTER TABLE sales ADD COLUMN customer_id BIGINT DEFAULT NULL;
ALTER TABLE sales ADD COLUMN points_earned INT NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN points_redeemed INT NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN points_discount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
