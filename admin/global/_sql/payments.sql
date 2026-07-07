-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
-- Generation Time: Jun 15, 2026 at 05:57 AM
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
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `payment_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `p_amount` decimal(10,2) NOT NULL,
  `p_currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'USD',
  `type` tinyint DEFAULT NULL COMMENT '1=sub,2=onetime',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0''pending'', 1''completed'', 2''refunded'', 3''failed''',
  `p_transaction_reference` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'from Stripe/PayPal/Apple/Google',
  `user_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `variant_ref` int NOT NULL,
  `p_created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `p_updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`payment_id`, `p_amount`, `p_currency`, `type`, `status`, `p_transaction_reference`, `user_id_ref`, `variant_ref`, `p_created_at`, `p_updated_at`) VALUES
('pay0gt1a7yt1fj0nnm0xc9qq7nzt0xev08', 8.99, 'USD', NULL, 0, NULL, '0000000000', 2, '2026-03-13 12:59:39', '2026-03-13 12:59:39'),
('pay4gl7eihahgnhsuon', 18.99, 'USD', NULL, 0, NULL, '0000000000', 3, '2026-03-13 18:14:40', '2026-03-13 18:14:40');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `fk_variant_ref` (`variant_ref`),
  ADD KEY `fk_userid_ref` (`user_id_ref`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_userid_ref` FOREIGN KEY (`user_id_ref`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_variant_ref` FOREIGN KEY (`variant_ref`) REFERENCES `product_list_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
