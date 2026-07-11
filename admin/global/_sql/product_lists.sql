-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
-- Generation Time: Jul 11, 2026 at 10:17 PM
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
-- Table structure for table `product_lists`
--

CREATE TABLE `product_lists` (
  `pl_sku` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `pl_name` varchar(200) NOT NULL,
  `pl_description` json NOT NULL,
  `category` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `pl_is_active` enum('0','1') NOT NULL,
  `pl_created` timestamp NOT NULL,
  `pl_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `product_lists`
--

INSERT INTO `product_lists` (`pl_sku`, `pl_name`, `pl_description`, `category`, `pl_is_active`, `pl_created`, `pl_updated`) VALUES
('instantmessage_wu8yyur5mmmtua', 'Instant Message', '{\"features\": [{\"d\": \"\", \"e\": true}]}', 'instantmessage', '1', '2026-02-11 22:14:39', '2026-03-12 00:17:05'),
('plus_kywhm9u6ymw8ym3u69meno', 'plus', '{\"features\": [{\"d\": \"2 super likes per day\", \"e\": true}, {\"d\": \"See who liked you\", \"e\": true}, {\"d\": \"Unlimited matches\", \"e\": true}, {\"d\": \"Weekly profile boost\", \"e\": true}]}', 'mainsub', '1', '2026-01-09 22:31:25', '2026-03-12 00:19:24'),
('superlikes_4pqojouyyyur5uyihgj898', 'super likes', '{\"features\": [{\"d\": \"\", \"e\": true}]}', 'superlike', '1', '2026-01-10 23:45:04', '2026-03-12 00:20:56'),
('vip_91n46w586u0m4eomircybdvsz', 'vip', '{\"features\": [{\"d\": \"Unlimited Phone/Video calls\", \"e\": true}, {\"d\": \"Unlimited super likes\", \"e\": true}, {\"d\": \"Travel mode\", \"e\": true}, {\"d\": \"Priority customer support\", \"e\": true}]}', 'mainsub', '1', '2026-01-09 22:33:02', '2026-05-21 01:02:57');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `product_lists`
--
ALTER TABLE `product_lists`
  ADD PRIMARY KEY (`pl_sku`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
