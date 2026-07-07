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
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` varchar(50) NOT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `variant_id_ref` int NOT NULL,
  `start_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_date` timestamp NOT NULL,
  `external_platform` tinyint NOT NULL COMMENT '1''stripe'',2''apple'',3''google''',
  `external_id` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'stripe/google/ios',
  `payment_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` tinyint NOT NULL COMMENT '0''pending'',1''active'',2''past_due'',3''cancelled'',4''trialing''',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `subscriptions`
--

INSERT INTO `subscriptions` (`id`, `user_id`, `variant_id_ref`, `start_date`, `end_date`, `external_platform`, `external_id`, `payment_id_ref`, `status`, `date_created`, `date_modified`) VALUES
('52ifcxelxzp8uhb2sgbngafb7s1pisr1smox5', '00000b38e106853404025821449', 3, '2026-06-15 04:43:20', '2026-06-03 18:15:37', 0, 'sub_1TAaFoLWQbqqSt59CaElRuRj', 'pay9civ8sjbfz84hvkm08ejbmhd', 1, '2026-03-13 18:16:18', '2026-05-20 02:51:45'),
('fxfp5101gpfgzdzckb6g7ttx', '000000af6f492-eba8-4a35-996721', 3, '2026-06-15 04:43:20', '2026-05-28 06:15:34', 0, 'sub_1TA2WzLWQbqqSt59eVyY0nKl', NULL, 0, '2026-03-13 11:53:11', '2026-05-23 04:50:41');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_variant_id_ref` (`variant_id_ref`),
  ADD KEY `fk_user_id_ref` (`user_id`),
  ADD KEY `fk_payment_id_ref` (`payment_id_ref`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `fk_payment_id_ref` FOREIGN KEY (`payment_id_ref`) REFERENCES `payments` (`payment_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_user_id_ref` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_variant_id_ref` FOREIGN KEY (`variant_id_ref`) REFERENCES `product_list_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
