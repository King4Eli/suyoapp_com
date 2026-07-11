-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
-- Generation Time: Jul 11, 2026 at 04:21 PM
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
  `type` tinyint NOT NULL COMMENT '1=sub,2=onetime',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0=pending, 1=completed, 2=refunded, 3=failed, 4=expired',
  `p_transaction_reference` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'from Stripe/PayPal/Apple/Google',
  `user_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `variant_ref` int NOT NULL,
  `p_created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `p_updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`payment_id`, `p_amount`, `p_currency`, `type`, `status`, `p_transaction_reference`, `user_id_ref`, `variant_ref`, `p_created_at`, `p_updated_at`) VALUES
('pay0gt1a7yt1fj0nnm0xc9qq7nzt0xev08', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-13 12:59:39', '2026-07-11 16:21:50'),
('pay1k7drnasq7o0m01ec', 14.99, 'USD', 1, 4, NULL, '0000000000', 1, '2026-06-15 07:00:03', '2026-07-11 16:21:50'),
('pay4gl7eihahgnhsuon', 18.99, 'USD', 2, 4, NULL, '0000000000', 3, '2026-03-13 18:14:40', '2026-07-11 16:21:50'),
('pay9civ8sjbfz84hvkm08ejbmhd', 8.99, 'USD', 1, 4, NULL, '00000b38e106853404025821449', 2, '2026-03-13 18:14:30', '2026-07-11 16:21:50'),
('payapcj1gl5mljuftpv03k', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-13 12:56:15', '2026-07-11 16:21:50'),
('payawg8pdrc369vjqw6s', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 06:01:09', '2026-07-11 16:21:50'),
('paybv3bsvg8n2apcgv5idc5a37wv3y', 14.99, 'USD', 1, 4, NULL, '0000000000', 1, '2026-03-12 04:42:20', '2026-07-11 16:21:50'),
('paycinbaunfgdkwhkxhpg', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-13 12:59:12', '2026-07-11 16:21:50'),
('paycqaxtnrdzv', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-29 00:44:58', '2026-07-11 16:21:50'),
('paye2malvn8wf4dg649k', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 04:43:13', '2026-07-11 16:21:50'),
('paye5h0zxmks8', 18.99, 'USD', 1, 4, NULL, '0000000000', 3, '2026-03-13 18:15:26', '2026-07-11 16:21:50'),
('payewvj75hk2ruwwlhve3hkhip5cnq3zdec', 18.99, 'USD', 1, 4, NULL, '0000000000', 3, '2026-03-13 12:58:08', '2026-07-11 16:21:50'),
('payh1av4fpz5cq1xqra3g49rp4vr', 18.99, 'USD', 1, 4, NULL, '0000000000', 3, '2026-03-13 12:59:43', '2026-07-11 16:21:50'),
('payhugymoi7rllzshd', 18.99, 'USD', 1, 4, NULL, '0000000000', 3, '2026-03-26 00:32:23', '2026-07-11 16:21:50'),
('payhyn7hhtde1i1lqz36limafqn65990', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 06:01:21', '2026-07-11 16:21:50'),
('payjblkmb4s1v89ko9tpxtg8x0s5ipscymupzf', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 04:44:40', '2026-07-11 16:21:50'),
('paykpim9wo8rlcm', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-05-23 04:47:19', '2026-07-11 16:21:50'),
('paykuc9unz9nj1dl', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 05:59:37', '2026-07-11 16:21:50'),
('paymchcfc7y3rtyf4mwgyk0n', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 04:48:23', '2026-07-11 16:21:50'),
('paymtaoffzc4fhljd', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-06-15 06:23:42', '2026-07-11 16:21:50'),
('paynjogufqoty937fwpfmow623ozaysdyysmne8zp', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-06-15 06:16:25', '2026-07-11 16:21:50'),
('payp5ebt9ih78ekeb59zj2mjrk40hk51f1ipoj', 8.99, 'USD', 1, 4, NULL, '00000b38e106853404025821449', 2, '2026-03-13 18:19:24', '2026-07-11 16:21:50'),
('paypkrng545l8vb41cbp9', 10.99, 'USD', 1, 4, NULL, '0000000000', 5, '2026-05-23 04:49:27', '2026-07-11 16:21:50'),
('paypr5olnzgr25cxev10wqe5xy8v40', 14.99, 'USD', 1, 4, NULL, '0000000000', 1, '2026-03-12 05:59:32', '2026-07-11 16:21:50'),
('paypyj0scy1whm53', 14.99, 'USD', 1, 4, NULL, '0000000181dfe88da4245512', 2, '2026-07-10 03:29:14', '2026-07-11 16:21:50'),
('payt5s41ydzu3', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-05-23 04:51:28', '2026-07-11 16:21:50'),
('payu9er2lm6g3ecft41cp7jq', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 04:43:37', '2026-07-11 16:21:50'),
('payuejwks007eqmxxz0', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 04:42:35', '2026-07-11 16:21:50'),
('paywdkhmjh4i0p0dbiqlh', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-13 12:56:06', '2026-07-11 16:21:50'),
('payws1zowagh1yhkg1', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 04:44:15', '2026-07-11 16:21:50'),
('payzbwm48prjmi6ykf2', 8.99, 'USD', 1, 4, NULL, '00000b38e106853404025821449', 2, '2026-03-14 02:32:45', '2026-07-11 16:21:50'),
('pay_bg3mqv11759oin4zn49ub4p7', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 03:48:51', '2026-07-11 16:21:50'),
('pay_cf', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 03:42:59', '2026-07-11 16:21:50'),
('pay_g', 8.99, 'USD', 1, 4, NULL, '0000000000', 2, '2026-03-12 03:48:03', '2026-07-11 16:21:50');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `fk_variant_ref` (`variant_ref`),
  ADD KEY `fk_userid_ref` (`user_id_ref`),
  ADD KEY `status` (`status`),
  ADD KEY `idx_user_status` (`user_id_ref`,`status`);

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
