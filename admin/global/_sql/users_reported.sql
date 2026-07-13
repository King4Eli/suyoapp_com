-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
-- Generation Time: Jun 15, 2026 at 05:58 AM
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
-- Table structure for table `users_reported`
--

CREATE TABLE `users_reported` (
  `id_ai` bigint NOT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'the reported user',
  `reporter_user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'the user who filed the report',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0=open,1=resolved,2=escalated',
  `reason` text NOT NULL,
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_mod` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `users_reported`
--
ALTER TABLE `users_reported`
  ADD PRIMARY KEY (`id_ai`),
  ADD KEY `fk_userid_reported` (`user_id`),
  ADD KEY `fk_reporter_userid` (`reporter_user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users_reported`
--
ALTER TABLE `users_reported`
  MODIFY `id_ai` bigint NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `users_reported`
--
ALTER TABLE `users_reported`
  ADD CONSTRAINT `fk_userid_reported` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_reporter_userid` FOREIGN KEY (`reporter_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
