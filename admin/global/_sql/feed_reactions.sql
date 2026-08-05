-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: global_mysql:3306
-- Generation Time: Aug 04, 2026 at 12:00 AM
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
-- Table structure for table `feed_reactions`
--

CREATE TABLE `feed_reactions` (
  `id_ai` bigint NOT NULL AUTO_INCREMENT,
  `reaction_post_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `reaction_user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'the viewer reacting',
  `reaction_post_owner_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'denormalized poster id, so dislike-blocks work without joining feed_posts',
  `reaction_type` enum('1','-1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '1=like,-1=dislike (blocks the poster)',
  `reaction_dateAdded` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp()),
  PRIMARY KEY (`id_ai`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `feed_reactions`
--

--
-- Indexes for dumped tables
--

--
-- Indexes for table `feed_reactions`
--
ALTER TABLE `feed_reactions`
  ADD UNIQUE KEY `idx_reaction_unique` (`reaction_post_id`,`reaction_user_id`),
  ADD KEY `idx_reaction_blocklist` (`reaction_user_id`,`reaction_post_owner_id`,`reaction_type`),
  ADD KEY `fk_reaction_user` (`reaction_user_id`),
  ADD KEY `fk_reaction_owner` (`reaction_post_owner_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `feed_reactions`
--
ALTER TABLE `feed_reactions`
  ADD CONSTRAINT `fk_reaction_post` FOREIGN KEY (`reaction_post_id`) REFERENCES `feed_posts` (`post_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_reaction_user` FOREIGN KEY (`reaction_user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_reaction_owner` FOREIGN KEY (`reaction_post_owner_id`) REFERENCES `users` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
