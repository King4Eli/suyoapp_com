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
  `user_bio_company` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_bio_ethnicity` tinyint DEFAULT NULL,
  `user_bio_smoking` enum('0','1','2') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_prompt` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT '{}',
  `user_bio_drinking` enum('0','1','2') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_children` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_bio_religion` tinyint DEFAULT NULL,
  `user_bio_jobrole` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_bio_interests` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
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
  `user_preference_ethnicity` tinyint NOT NULL DEFAULT '-99',
  `user_preference_smoking` enum('0','1','2','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99' COMMENT '-99=any',
  `user_preference_distance` int NOT NULL DEFAULT '55' COMMENT '>100 global',
  `user_preference_drinking` enum('0','1','2','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99' COMMENT '-99=any',
  `user_preference_children` enum('0','1','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99',
  `user_preference_gender` tinyint NOT NULL DEFAULT '-99',
  `user_preference_pet` enum('0','1','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '-99',
  `user_preference_religion` tinyint NOT NULL DEFAULT '-99',
  `user_preference_politicalview` tinyint NOT NULL DEFAULT '-99',
  `user_preference_language` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `user_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`autoIncrement`, `user_id`, `user_email`, `user_phonenumber`, `user_phonenumber_meta`, `user_fullname`, `user_image`, `user_active`, `geo_meta`, `geo_hash`, `geo_long`, `geo_latd`, `user_verified`, `user_datecreated`, `user_last_accessed`, `user_signedup_device_stats`, `user_bio_highesteducation`, `user_auth_verificationcode`, `user_bio_relationshipgoal`, `user_bio_schoolattended`, `user_bio_politicalview`, `user_bio_hometown`, `user_bio_language`, `user_bio_company`, `user_bio_ethnicity`, `user_bio_smoking`, `user_bio_prompt`, `user_bio_drinking`, `user_bio_children`, `user_bio_religion`, `user_bio_jobrole`, `user_bio_interests`, `user_bio_gender`, `user_bio_haspet`, `user_bio_about`, `user_bio_height`, `user_bio_dob`, `user_preference_minimum_age`, `user_preference_maximum_age`, `user_preference_highesteducation`, `user_preference_height_minimum`, `user_preference_height_maximum`, `user_preference_relationshipgoal`, `user_preference_ethnicity`, `user_preference_smoking`, `user_preference_distance`, `user_preference_drinking`, `user_preference_children`, `user_preference_gender`, `user_preference_pet`, `user_preference_religion`, `user_preference_politicalview`, `user_preference_language`, `user_settings`) VALUES
(1, '0000000000', '8506317422@tmomail.net', '0000000002', NULL, 'ffendi r00t', '[{\"p\":\"/dtt-100/users/0000000000/profile_media/1779245124338-b227657f9c53e3bf.webp\",\"w\":474,\"h\":506},{\"p\":\"/static/img/peoples2/0000000000-1765769936-61846531-2.jpg\",\"w\":447,\"h\":447},{\"p\":\"/static/img/peoples2/0000000000-1765769936-79714153-4.jpg\",\"w\":374,\"h\":534},{\"p\":\"/dtt-100/users/0000000000/profile_media/1779251429522-83844d7d013fba3e.webp\",\"w\":474,\"h\":710}]', '1', '{\"city\": \"Tallahassee\", \"latd\": 30.47733, \"long\": -84.26594, \"road\": \"Mimosa Drive\", \"speed\": 0, \"state\": \"Florida\", \"street\": \"unknown\", \"country\": \"United States\", \"heading\": 0, \"accuracy\": 5, \"altitude\": 0, \"postcode\": \"32312\", \"timestamp\": 1781417398175, \"display_name\": \"1071, Mimosa Drive, Tallahassee, Leon County, Florida, 32312, United States\", \"neighbourhood\": \"unknown\", \"altitudeAccuracy\": 0.5}', 'djkj7', -84.2322681, 30.4853386, '1', '2025-11-18 14:24:12', '2026-06-15 04:06:03', '[]', 0, NULL, 0, '', 6, 'Yaya', '[]', NULL, 0, '1', '[]', '0', '1', 0, NULL, '[]', 1, '0', '🙃', 150, '20010502', 18, 39, -99, 153, 180, 2, -99, '-99', 105, '-99', '-99', -99, '-99', -99,-99, '-99', '{\"0\":\"{\",\"1\":\"}\",\"notifications\":{\"channels\":{\"inApp\":false,\"email\":false},\"masterToggle\":false,\"quietHours\":{\"enabled\":true,\"start\":\"21:00\",\"end\":\"07:00\"},\"emailCadence\":\"Daily\",\"newMatches\":true,\"mutualLikes\":false,\"newMessages\":true,\"matchSuggestions\":true,\"inactiveReminders\":false,\"limitedOffers\":false,\"datingTips\":true,\"selectedPreset\":\"quiet\",\"interestAlerts\":true,\"profileHighlights\":true,\"appNews\":false,\"featureUpdates\":false,\"marketingPause\":true,\"mood\":\"Focused\"}}'),
(2, '0000000181dfe88da4245512', 'toballz@example.com', '8506317422', NULL, 'zoe', '[{\"p\": \"/static/img/peoples0/3349282-9565999171297-a86ac76a963641.jpeg\", \"w\": 3024, \"h\": 4032}, {\"p\": \"/static/img/peoples0/3349282-525358449435-0bc2ceefb7da.jpeg\", \"w\": 2448, \"h\": 3060}, {\"p\": \"/static/img/peoples0/3349282-7687436587699-a129fc6c8d0740f0953e.jpeg\", \"w\": 1242, \"h\": 1925}, {\"p\": \"/static/img/peoples0/3349282-3090459836452-ccf8d068faa1425aaa6.jpeg\", \"w\": 1284, \"h\": 1750}, {\"p\": \"/static/img/peoples0/3349282-6211743589510-2d4ad965fbfe4c99.jpeg\", \"w\": 1080, \"h\": 1350}, {\"p\": \"/static/img/peoples0/3349282-1524538091188-0b4a8b74df.jpeg\", \"w\": 964, \"h\": 1167}]', '1', '{\"city\": \"San Francisco\", \"road\": \"Ellis Street\", \"speed\": -1, \"state\": \"California\", \"street\": \"unknown\", \"country\": \"United States\", \"heading\": -1, \"accuracy\": 5, \"altitude\": 0, \"postcode\": \"94104\", \"timestamp\": 1770149809745.689, \"display_name\": \"Ellis Street & Stockton Street, Ellis Street, Union Square, South of Market, San Francisco, California, 94104, United States\", \"neighbourhood\": \"Union Square\", \"altitudeAccuracy\": -1}', '9q8yy', -122.406417, 37.785834, '1', '2025-09-19 02:59:30', '2026-05-27 06:19:17', '', 1, NULL, 5, NULL, 0, NULL, NULL, NULL, NULL, '0', '[{\"q\":\"The hallmark of a good relationship is\",\"a\":\"Mutual respect and shared financial goals\"},{\"q\":\"I give great advice about\",\"a\":\"Interest rates and real estate\"}]', '2', '0', NULL, NULL, NULL, 0, '0', 'i like white men w big noses', NULL, '20050323', 23, 25, -99, 153, 180, 0, -99, '-99', 105, '-99', '-99', 0, '-99', -99,-99, NULL, '');

--
-- Indexes for dumped tables
--

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
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `autoIncrement` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1815;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
