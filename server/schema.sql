-- LUMENVEIL schema — MariaDB 10.4 (XAMPP)
-- Jalankan: C:\xampp\mysql\bin\mysql.exe -u root < schema.sql
CREATE DATABASE IF NOT EXISTS lumenveil_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lumenveil_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  pass_hash VARCHAR(128) NOT NULL,
  salt VARCHAR(32) NOT NULL,
  token VARCHAR(64) DEFAULT NULL,
  gems INT NOT NULL DEFAULT 16000,
  sigils INT NOT NULL DEFAULT 0,
  owned TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS banner_state (
  user_id INT NOT NULL,
  banner VARCHAR(16) NOT NULL,
  pulls INT NOT NULL DEFAULT 0,
  pity5 INT NOT NULL DEFAULT 0,
  pity4 INT NOT NULL DEFAULT 0,
  guaranteed TINYINT NOT NULL DEFAULT 0,
  five_total INT NOT NULL DEFAULT 0,
  five_log TEXT DEFAULT NULL,
  last_five_at INT DEFAULT NULL,
  prev_five_at INT DEFAULT NULL,
  featured_won INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, banner),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pull_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  banner VARCHAR(16) NOT NULL,
  item_name VARCHAR(64) NOT NULL,
  rarity TINYINT NOT NULL,
  is_featured TINYINT NOT NULL DEFAULT 0,
  duplicate INT NOT NULL DEFAULT 0,
  pulled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_time (user_id, pulled_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
