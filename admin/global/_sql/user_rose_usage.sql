-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
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
-- Database: `api_suyoapp_com`
--

-- --------------------------------------------------------

--
-- Table structure for table `user_rose_usage`
-- One row per user. `rose_balance` is purchased roses and persists indefinitely.
-- `daily_used`/`daily_reset_date` track the free tier allowance (2/5/10 per day by tier);
-- callers must check `daily_reset_date` against CURRENT_DATE and zero `daily_used` when
-- it's stale, since there is no daily cron to do this proactively.
--

CREATE TABLE `user_rose_usage` (
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `rose_balance` int NOT NULL DEFAULT '0' COMMENT 'purchased roses',
  `daily_used` int NOT NULL DEFAULT '0' COMMENT 'free-tier roses used on daily_reset_date',
  `daily_reset_date` date NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'the date daily_used applies to'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_rose_usage`
--

--
-- Indexes for dumped tables
--

--
-- Indexes for table `user_rose_usage`
--
ALTER TABLE `user_rose_usage`
  ADD PRIMARY KEY (`user_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `user_rose_usage`
--
ALTER TABLE `user_rose_usage`
  ADD CONSTRAINT `fk_user_rose_usage_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
