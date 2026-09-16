-- MariaDB 10.11 Production Schema for Custom Appointment & Scheduling Engine
-- YYC Reflexology Clinic (10880 Hidden Valley DR NW Calgary)

CREATE DATABASE IF NOT EXISTS `maxgtcco_yyc_booking` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `maxgtcco_yyc_booking`;

-- 1. Services directory
CREATE TABLE IF NOT EXISTS `services` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Service pricing & duration tiers
CREATE TABLE IF NOT EXISTS `service_tiers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `service_id` INT UNSIGNED NOT NULL,
  `duration_minutes` SMALLINT UNSIGNED NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'CAD',
  CONSTRAINT `fk_tiers_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uniq_service_duration` (`service_id`, `duration_minutes`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bookings directory
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `service_tier_id` INT UNSIGNED NOT NULL,
  `client_name` VARCHAR(255) NOT NULL,
  `client_email` VARCHAR(255) NOT NULL,
  `client_phone` VARCHAR(50) NOT NULL,
  `client_address` VARCHAR(255) NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `total_price` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('CONFIRMED', 'CANCELLED') DEFAULT 'CONFIRMED',
  `cancellation_reason` VARCHAR(500) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bookings_tier` FOREIGN KEY (`service_tier_id`) REFERENCES `service_tiers` (`id`),
  INDEX `idx_booking_dates` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Practitioner availability time blocks (Single Source of Truth)
CREATE TABLE IF NOT EXISTS `time_blocks` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `block_type` ENUM('BOOKED', 'BLOCKED') NOT NULL,
  `reason` VARCHAR(255) NULL,
  `booking_id` INT UNSIGNED NULL,
  CONSTRAINT `fk_blocks_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  INDEX `idx_block_lookup` (`start_time`, `end_time`, `block_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Services & Standard Pricing Tiers
INSERT INTO services (id, name, description, is_active) VALUES
(1, 'Foot Reflexology Therapy', 'Targeted stimulation of neurological reflex zones in feet to restore equilibrium, relieve tension, and enhance circulation.', TRUE),
(2, 'Hand & Palm Reflexology', 'Precision pressure technique on neuromuscular zones of the palms and fingers to relieve repetitive strain and upper body stress.', TRUE),
(3, 'Combined Integrated Reflexology', 'Comprehensive therapeutic dual-treatment focusing on both foot and hand meridian points for full autonomic nervous balance.', TRUE),
(4, 'Deep Meridian Care', 'Specialized therapeutic focus addressing persistent structural fatigue, chronic inflammation, and plantar fascial tension.', TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`);

-- Seed Tier Matrix (30m, 45m, 60m)
INSERT INTO `service_tiers` (`service_id`, `duration_minutes`, `price`, `currency`) VALUES
(1, 30, 65.00, 'CAD'),
(1, 45, 90.00, 'CAD'),
(1, 60, 115.00, 'CAD'),

(2, 30, 60.00, 'CAD'),
(2, 45, 85.00, 'CAD'),
(2, 60, 110.00, 'CAD'),

(3, 30, 75.00, 'CAD'),
(3, 45, 105.00, 'CAD'),
(3, 60, 135.00, 'CAD'),

(4, 30, 80.00, 'CAD'),
(4, 45, 110.00, 'CAD'),
(4, 60, 140.00, 'CAD')
ON DUPLICATE KEY UPDATE `price` = VALUES(`price`);

-- 5. Clinic Configuration Settings (Working hours)
CREATE TABLE IF NOT EXISTS `clinic_settings` (
  `setting_key` VARCHAR(50) PRIMARY KEY,
  `setting_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Clinic Holidays / Closure Days
CREATE TABLE IF NOT EXISTS `clinic_holidays` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `holiday_date` DATE NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Settings
INSERT INTO `clinic_settings` (`setting_key`, `setting_value`) VALUES
('clinic_start_time', '09:00'),
('clinic_end_time', '18:00')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
