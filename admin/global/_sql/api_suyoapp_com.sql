-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
-- Generation Time: Jul 12, 2026 at 12:08 AM
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
-- Table structure for table `conversations`
--

CREATE TABLE `conversations` (
  `convo_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `convo_match_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `convo_message` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `convo_by_initiator` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `convo_status` enum('0','1','2') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0' COMMENT '0=noread 1=read -99=deleted',
  `convo_date_added` bigint UNSIGNED DEFAULT (unix_timestamp()),
  `convo_date_updated` bigint UNSIGNED DEFAULT (unix_timestamp())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `interests_variant`
--

CREATE TABLE `interests_variant` (
  `id_ai` int NOT NULL,
  `category` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `interested_in` varchar(50) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `mapping_lookup`
--

CREATE TABLE `mapping_lookup` (
  `map_id` int NOT NULL,
  `map_type` enum('bio_gender','account_status','account_verified','bio_intent','bio_children','bio_smoking','bio_drinking','bio_education','bio_pets','bio_bodytype','bio_ethnicity','bio_interests','bio_premium','bio_language','bio_religion','bio_politicalview','bio_prompt','bundle_version','img_domain','convo_status') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `map_code` tinyint(1) NOT NULL,
  `map_label` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `matches`
--

CREATE TABLE `matches` (
  `match_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `match_user_id_from` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `match_user_id_to` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `match_status` enum('0','1','2','3','4','5') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0' COMMENT '0=waiting,1=match,2=notinterested,3=block,4=reported,5=superlike',
  `last_message_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `match_dateAdded` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp()),
  `match_dateUpdated` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `prompts_variant`
--

CREATE TABLE `prompts_variant` (
  `id_ai` bigint NOT NULL,
  `question` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stripe_events`
--

CREATE TABLE `stripe_events` (
  `event_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `processed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `cancel_at_period_end` tinyint(1) NOT NULL DEFAULT '0',
  `canceled_at` timestamp NULL DEFAULT NULL,
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `autoIncrement` int NOT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_email` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_phonenumber` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_phonenumber_meta` json DEFAULT NULL,
  `user_fullname` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_image` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `user_active` enum('0','1','2','3','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '1',
  `geo_meta` json NOT NULL,
  `geo_hash` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `geo_long` double NOT NULL,
  `geo_latd` double NOT NULL,
  `user_verified` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `user_datecreated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_last_accessed` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_signedup_device_stats` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_highesteducation` tinyint DEFAULT NULL,
  `user_auth_verificationcode` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_bio_relationshipgoal` tinyint DEFAULT NULL,
  `user_bio_schoolattended` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_bio_politicalview` tinyint DEFAULT NULL,
  `user_bio_hometown` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_bio_language` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `user_bio_bodytype` tinyint DEFAULT NULL,
  `user_bio_company` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_bio_ethnicity` tinyint DEFAULT NULL,
  `user_bio_smoking` enum('0','1','2') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_drinking` enum('0','1','2') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_children` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_religion` tinyint DEFAULT NULL,
  `user_bio_jobrole` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_bio_gender` int NOT NULL,
  `user_bio_haspet` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_about` varchar(400) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_height` int DEFAULT NULL COMMENT 'in cm, 100-220',
  `user_bio_dob` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'yyyyMmDd',
  `user_preference_minimum_age` tinyint NOT NULL DEFAULT '18',
  `user_preference_maximum_age` tinyint NOT NULL DEFAULT '25',
  `user_preference_highesteducation` tinyint NOT NULL DEFAULT '-99',
  `user_preference_height_minimum` int NOT NULL DEFAULT '153' COMMENT 'in cm, 100-220',
  `user_preference_height_maximum` int NOT NULL DEFAULT '180' COMMENT 'in cm, 100-220',
  `user_preference_relationshipgoal` tinyint NOT NULL DEFAULT '-99',
  `user_preference_bodytype` tinyint NOT NULL DEFAULT '-99',
  `user_preference_ethnicity` tinyint NOT NULL DEFAULT '-99',
  `user_preference_smoking` enum('0','1','2','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99' COMMENT '-99=any',
  `user_preference_distance` int NOT NULL DEFAULT '55' COMMENT '>100 global',
  `user_preference_drinking` enum('0','1','2','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99' COMMENT '-99=any',
  `user_preference_children` enum('0','1','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99',
  `user_preference_gender` tinyint NOT NULL DEFAULT '-99',
  `user_preference_pet` enum('0','1','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99',
  `user_preference_religion` tinyint NOT NULL DEFAULT '-99',
  `user_preference_language` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `user_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users_interests`
--

CREATE TABLE `users_interests` (
  `id_ai` int NOT NULL,
  `user_id` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `interests_variant_ref_id` int NOT NULL,
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users_prompt`
--

CREATE TABLE `users_prompt` (
  `id_ai` bigint NOT NULL,
  `user_id` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `prompts_variant_ref_id` bigint NOT NULL,
  `answer` varchar(100) NOT NULL,
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users_reported`
--

CREATE TABLE `users_reported` (
  `id_ai` bigint NOT NULL,
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  `reason` text NOT NULL,
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_mod` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `conversations`
--
ALTER TABLE `conversations`
  ADD PRIMARY KEY (`convo_id`),
  ADD KEY `fk_convo_match_id` (`convo_match_id`);

--
-- Indexes for table `interests_variant`
--
ALTER TABLE `interests_variant`
  ADD PRIMARY KEY (`id_ai`);

--
-- Indexes for table `logreports`
--
ALTER TABLE `logreports`
  ADD PRIMARY KEY (`report_id`),
  ADD KEY `fk_report_user` (`report_currentuser`);

--
-- Indexes for table `mapping_lookup`
--
ALTER TABLE `mapping_lookup`
  ADD PRIMARY KEY (`map_id`),
  ADD UNIQUE KEY `map_type` (`map_type`,`map_code`);

--
-- Indexes for table `matches`
--
ALTER TABLE `matches`
  ADD PRIMARY KEY (`match_id`),
  ADD UNIQUE KEY `idx_match_userid_pair_reverse` (`match_user_id_to`,`match_user_id_from`),
  ADD UNIQUE KEY `idx_match_userid_pair` (`match_user_id_from`,`match_user_id_to`),
  ADD KEY `fk_last_message` (`last_message_id`);

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
-- Indexes for table `product_lists`
--
ALTER TABLE `product_lists`
  ADD PRIMARY KEY (`pl_sku`);

--
-- Indexes for table `product_list_variant`
--
ALTER TABLE `product_list_variant`
  ADD PRIMARY KEY (`id_ai`),
  ADD KEY `product_list_variant_fk` (`product_lists_id_ref`);

--
-- Indexes for table `prompts_variant`
--
ALTER TABLE `prompts_variant`
  ADD PRIMARY KEY (`id_ai`);

--
-- Indexes for table `stripe_events`
--
ALTER TABLE `stripe_events`
  ADD PRIMARY KEY (`event_id`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_variant_id_ref` (`variant_id_ref`),
  ADD KEY `fk_user_id_ref` (`user_id`),
  ADD KEY `fk_payment_id_ref` (`payment_id_ref`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `user_email` (`user_email`),
  ADD UNIQUE KEY `user_phonenumber` (`user_phonenumber`),
  ADD UNIQUE KEY `autoIncrement_ai` (`autoIncrement`),
  ADD KEY `idx_active` (`user_active`),
  ADD KEY `idx_dob` (`user_bio_dob`),
  ADD KEY `idx_gender` (`user_bio_gender`),
  ADD KEY `user_geo_hash` (`geo_hash`);

--
-- Indexes for table `users_interests`
--
ALTER TABLE `users_interests`
  ADD PRIMARY KEY (`id_ai`),
  ADD KEY `fk_interests_user_id` (`user_id`),
  ADD KEY `fk_interests_variant_id_ref` (`interests_variant_ref_id`);

--
-- Indexes for table `users_prompt`
--
ALTER TABLE `users_prompt`
  ADD PRIMARY KEY (`id_ai`),
  ADD KEY `fk_prompt_user_id` (`user_id`),
  ADD KEY `fk_prompts_variant_id` (`prompts_variant_ref_id`);

--
-- Indexes for table `users_reported`
--
ALTER TABLE `users_reported`
  ADD PRIMARY KEY (`id_ai`),
  ADD KEY `fk_userid_reported` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `interests_variant`
--
ALTER TABLE `interests_variant`
  MODIFY `id_ai` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mapping_lookup`
--
ALTER TABLE `mapping_lookup`
  MODIFY `map_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_list_variant`
--
ALTER TABLE `product_list_variant`
  MODIFY `id_ai` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `prompts_variant`
--
ALTER TABLE `prompts_variant`
  MODIFY `id_ai` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `autoIncrement` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users_interests`
--
ALTER TABLE `users_interests`
  MODIFY `id_ai` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users_prompt`
--
ALTER TABLE `users_prompt`
  MODIFY `id_ai` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users_reported`
--
ALTER TABLE `users_reported`
  MODIFY `id_ai` bigint NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `conversations`
--
ALTER TABLE `conversations`
  ADD CONSTRAINT `fk_convo_match_id` FOREIGN KEY (`convo_match_id`) REFERENCES `matches` (`match_id`) ON DELETE CASCADE;

--
-- Constraints for table `logreports`
--
ALTER TABLE `logreports`
  ADD CONSTRAINT `fk_report_user` FOREIGN KEY (`report_currentuser`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `matches`
--
ALTER TABLE `matches`
  ADD CONSTRAINT `fk_last_message` FOREIGN KEY (`last_message_id`) REFERENCES `conversations` (`convo_id`) ON DELETE SET NULL ON UPDATE SET NULL,
  ADD CONSTRAINT `fk_match_user_id_from` FOREIGN KEY (`match_user_id_from`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_match_user_id_to` FOREIGN KEY (`match_user_id_to`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_userid_ref` FOREIGN KEY (`user_id_ref`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_variant_ref` FOREIGN KEY (`variant_ref`) REFERENCES `product_list_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Constraints for table `product_list_variant`
--
ALTER TABLE `product_list_variant`
  ADD CONSTRAINT `product_list_variant_fk` FOREIGN KEY (`product_lists_id_ref`) REFERENCES `product_lists` (`pl_sku`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Constraints for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `fk_payment_id_ref` FOREIGN KEY (`payment_id_ref`) REFERENCES `payments` (`payment_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_user_id_ref` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_variant_id_ref` FOREIGN KEY (`variant_id_ref`) REFERENCES `product_list_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Constraints for table `users_interests`
--
ALTER TABLE `users_interests`
  ADD CONSTRAINT `fk_interests_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_interests_variant_id_ref` FOREIGN KEY (`interests_variant_ref_id`) REFERENCES `interests_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Constraints for table `users_prompt`
--
ALTER TABLE `users_prompt`
  ADD CONSTRAINT `fk_prompt_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_prompts_variant_id` FOREIGN KEY (`prompts_variant_ref_id`) REFERENCES `prompts_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Constraints for table `users_reported`
--
ALTER TABLE `users_reported`
  ADD CONSTRAINT `fk_userid_reported` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
