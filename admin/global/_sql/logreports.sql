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
-- Table structure for table `logreports`
--

CREATE TABLE `logreports` (
  `report_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `report_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'undefined',
  `report_status` tinyint NOT NULL DEFAULT '0',
  `report_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT '{\r\n ''id'':"",\r\n ''todo'':""\r\n}',
  `report_currentuser` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp()),
  `updated_at` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `logreports`
--

INSERT INTO `logreports` (`report_id`, `report_type`, `report_status`, `report_data`, `report_currentuser`, `created_at`, `updated_at`) VALUES
('7vzx36ir10wfa3r4pl7thrkk', 'http -image', 0, '{\"type\":\"http -image\",\"_error\":{\"url\":\"https://s3.global.local\",\"useraction\":\"Image Load\",\"description\":\"Image load\"},\"user\":{\"currentuser\":\"0000000000\"},\"device\":{\"Id\":\"goldfish_x86_64\",\"Type\":\"Handset\",\"Model\":\"sdk_gphone16k_x86_64\",\"Brand\":\"google\",\"ScreenDimension\":{\"width\":411.42857142857144,\"height\":891.4285714285714,\"scale\":3.5,\"fontScale\":1},\"Os\":\"Android_17\",\"Name\":\"sdk_gphone16k_x86_64\",\"Device\":\"emu64xa16k\",\"isEmulator\":true,\"Manufacturer\":\"Google\",\"SerialNumber\":\"unknown\",\"Bootloader\":\"unknown\",\"Fingerprint\":\"google/sdk_gphone16k_x86_64/emu64xa16k:17/CP21.260330.005/15181570:userdebug/dev-keys\",\"UserAgent\":\"Mozilla/5.0 (Linux; Android 17; sdk_gphone16k_x86_64 Build/CP21.260330.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/145.0.7632.218 Mobile Safari/537.36\",\"BaseOs\":\"\",\"BatteryLevel\":1,\"Carrier\":\"T-Mobile\",\"Codename\":\"REL\",\"Token\":\"unknown\",\"isPinOrFingerprintSet\":false,\"isMouseConnected\":false,\"InstallationId\":\"426518a4dd23f649\",\"requestIP\":\"172.18.0.1\"},\"app\":{\"version_app\":\"1.0.0\",\"version_bundle\":\"2.5.1\",\"buildNumber_app\":\"1\",\"buildNumber_bundle\":\"0\",\"displayName_app\":\"datingapp\",\"displayName_bundle\":\"datingapp\",\"appPackageName\":\"com.datingapp\",\"appVersionName\":\"1.0.0.1\",\"FirstInstallTime\":1778186261815,\"LastUpdateTime\":1778816713936,\"apiVersion\":\"1.0.0\"}}', '0000000000', 1782250504, 1782250504);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `logreports`
--
ALTER TABLE `logreports`
  ADD PRIMARY KEY (`report_id`),
  ADD KEY `fk_report_user` (`report_currentuser`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `logreports`
--
ALTER TABLE `logreports`
  ADD CONSTRAINT `fk_report_user` FOREIGN KEY (`report_currentuser`) REFERENCES `users` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
