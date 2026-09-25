-- =========================================================
-- Migration 003: Staff salary accounts (Cash / Bank / bKash / Nagad / Rocket)
-- MySQL / TiDB Cloud. Run once against your database.
--
-- NOTE: No real money is sent. Salary payments to Bank / bKash /
-- Nagad / Rocket are recorded as DEMO transfers (is_demo = 1).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Staff payout accounts
--    status: 'Active'  -> salary goes here
--            'Pending' -> change requested by staff, waiting for Admin
--            'Old'     -> replaced (kept for history)
--            'Rejected'-> Admin rejected the change request
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `staff_accounts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `method` VARCHAR(20) NOT NULL,              -- Cash | Bank | bKash | Nagad | Rocket
  `account_no` VARCHAR(40) DEFAULT NULL,      -- NULL for Cash
  `account_name` VARCHAR(120) DEFAULT NULL,   -- name on the account
  `bank_name` VARCHAR(120) DEFAULT NULL,      -- Bank only
  `branch` VARCHAR(120) DEFAULT NULL,         -- Bank only
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `requested_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `reviewed_by` INT(11) DEFAULT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sa_user` (`user_id`),
  KEY `idx_sa_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------
-- 2) Snapshot of where each salary went
--    (kept even if the staff later changes their account)
-- ---------------------------------------------------------
ALTER TABLE `salary_payments` ADD COLUMN `payment_method` VARCHAR(20) NOT NULL DEFAULT 'Cash';
ALTER TABLE `salary_payments` ADD COLUMN `account_no` VARCHAR(40) DEFAULT NULL;
ALTER TABLE `salary_payments` ADD COLUMN `bank_name` VARCHAR(120) DEFAULT NULL;
ALTER TABLE `salary_payments` ADD COLUMN `txn_ref` VARCHAR(60) DEFAULT NULL;
ALTER TABLE `salary_payments` ADD COLUMN `is_demo` TINYINT(1) NOT NULL DEFAULT 0;
