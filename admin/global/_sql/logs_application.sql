-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
-- Generation Time: Jun 23, 2026 at 09:46 PM
-- Server version: 8.0.46
-- PHP Version: 8.3.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `datingapp_kojo`
--

-- --------------------------------------------------------

--
-- Table structure for table `logs_application`
--
-- Renamed from `logreports`: this table is application/server log data
-- (errors, HTTP failures, etc.), not user-submitted moderation reports.
-- Those now live in `users_reported`.
--

CREATE TABLE `logs_application` (
  `report_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `report_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'undefined',
  `report_status` tinyint NOT NULL DEFAULT '0',
  `report_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT '{\r\n ''id'':"",\r\n ''todo'':""\r\n}',
  `report_currentuser` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `device_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'references users_devices.device_id; replaces embedding full device info per log',
  `created_at` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp()),
  `updated_at` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `logs_application`
--
ALTER TABLE `logs_application`
  ADD PRIMARY KEY (`report_id`),
  ADD KEY `fk_report_user` (`report_currentuser`),
  ADD KEY `idx_report_device` (`device_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `logs_application`
--
ALTER TABLE `logs_application`
  ADD CONSTRAINT `fk_report_user` FOREIGN KEY (`report_currentuser`) REFERENCES `users` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
