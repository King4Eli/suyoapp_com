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
-- Table structure for table `product_list_variant`
--

CREATE TABLE `product_list_variant` (
  `id_ai` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` json NOT NULL,
  `price` decimal(11,2) NOT NULL DEFAULT '0.00',
  `billing_cycle` tinyint NOT NULL DEFAULT '1' COMMENT '1''once'',2''weekly'',3''biweekly'',4''monthly'',5''yearly'',',
  `product_lists_id_ref` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `active` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `external_3rdparty_store_product_id` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `product_list_variant`
--

INSERT INTO `product_list_variant` (`id_ai`, `name`, `description`, `price`, `billing_cycle`, `product_lists_id_ref`, `active`, `date_created`, `date_updated`, `external_3rdparty_store_product_id`) VALUES
(1, 'weekly', '{\"cycle\": \"weekly\", \"discount\": \"15% off\"}', 8.99, 3, 'plus_kywhm9u6ymw8ym3u69meno', '1', '2026-03-08 11:38:22', '2026-06-15 07:01:41', 'com.vintolab.suyoapp.plus.weekly'),
(2, 'biweekly', '{\"cycle\": \"biweekly\", \"discount\": \"\"}', 14.99, 2, 'plus_kywhm9u6ymw8ym3u69meno', '1', '2026-03-08 11:38:22', '2026-06-15 07:01:45', 'com.vintolab.suyoapp.plus.biweekly'),
(3, 'monthly', '{\"cycle\": \"monthly\", \"discount\": \"30% off\"}', 19.99, 4, 'plus_kywhm9u6ymw8ym3u69meno', '1', '2026-03-08 11:38:22', '2026-06-15 07:04:43', 'com.vintolab.suyoapp.plus.monthly'),
(4, 'weekly', '{\"cycle\": \"weekly\", \"discount\": \"15% off\"}', 10.99, 3, 'vip_91n46w586u0m4eomircybdvsz', '1', '2026-03-08 11:38:22', '2026-06-15 07:07:33', 'com.vintolab.suyoapp.vip.weekly'),
(5, 'biweekly', '{\"cycle\": \"biweekly\", \"discount\": \"\"}', 16.99, 2, 'vip_91n46w586u0m4eomircybdvsz', '1', '2026-03-08 11:38:22', '2026-06-15 07:03:39', 'com.vintolab.suyoapp.vip.biweekly'),
(6, 'monthly', '{\"cycle\": \"monthly\", \"discount\": \"30% off\"}', 21.99, 4, 'vip_91n46w586u0m4eomircybdvsz', '1', '2026-03-08 11:38:22', '2026-06-15 06:41:25', 'com.vintolab.suyoapp.vip.monthly'),
(7, '10 Roses', '{\"roses\": 10}', 2.99, 1, 'superlikes_4pqojouyyyur5uyihgj898', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'com.vintolab.suyoapp.roses.10'),
(8, '25 Roses', '{\"roses\": 25}', 5.99, 1, 'superlikes_4pqojouyyyur5uyihgj898', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'com.vintolab.suyoapp.roses.25'),
(9, '60 Roses', '{\"roses\": 60}', 9.99, 1, 'superlikes_4pqojouyyyur5uyihgj898', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'com.vintolab.suyoapp.roses.60'),
(10, '1 Rewind', '{\"rewinds\": 1}', 1.45, 1, 'rewind_7hqm3xk9pzalvbnw2e', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'com.vintolab.suyoapp.rewind.1');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `product_list_variant`
--
ALTER TABLE `product_list_variant`
  ADD PRIMARY KEY (`id_ai`),
  ADD KEY `product_list_variant_fk` (`product_lists_id_ref`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `product_list_variant`
--
ALTER TABLE `product_list_variant`
  MODIFY `id_ai` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `product_list_variant`
--
ALTER TABLE `product_list_variant`
  ADD CONSTRAINT `product_list_variant_fk` FOREIGN KEY (`product_lists_id_ref`) REFERENCES `product_lists` (`pl_sku`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
