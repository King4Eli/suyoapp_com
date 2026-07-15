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
-- Database: `datingapp_kojo`
--

-- --------------------------------------------------------

--
-- Table structure for table `iap_transactions`
--
-- Idempotency + audit trail for native App Store / Play Store purchases, mirroring the
-- role `stripe_events` plays for the Stripe webhook: the client posts the store transaction
-- once (possibly more than once, e.g. app relaunch before finishTransaction), and the unique
-- key on transaction_id makes replays a no-op instead of double-granting entitlements.

CREATE TABLE `iap_transactions` (
  `transaction_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Apple transactionId or Google purchaseToken',
  `platform` tinyint NOT NULL COMMENT '2=apple,3=google (matches subscriptions.external_platform)',
  `product_id` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'store product id, must match product_list_variant.external_3rdparty_store_product_id',
  `variant_id_ref` int NOT NULL,
  `user_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `payment_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `match_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'set for rewind one-time purchases',
  `verification_mode` tinyint NOT NULL DEFAULT '0' COMMENT '0=pseudo (dev, unverified), 1=verified against Apple/Google',
  `verification_response` json DEFAULT NULL COMMENT 'raw verifyReceipt/App Store Server API/Play Developer API response, kept for support/debugging',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0=pending,1=verified,2=failed',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `iap_transactions`
--
ALTER TABLE `iap_transactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD KEY `fk_iap_user_id_ref` (`user_id_ref`),
  ADD KEY `fk_iap_payment_id_ref` (`payment_id_ref`),
  ADD KEY `fk_iap_variant_id_ref` (`variant_id_ref`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `iap_transactions`
--
ALTER TABLE `iap_transactions`
  ADD CONSTRAINT `fk_iap_userid_ref` FOREIGN KEY (`user_id_ref`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_iap_payment_ref` FOREIGN KEY (`payment_id_ref`) REFERENCES `payments` (`payment_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_iap_variant_ref` FOREIGN KEY (`variant_id_ref`) REFERENCES `product_list_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
