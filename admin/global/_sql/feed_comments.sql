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
-- Table structure for table `feed_comments`
--

CREATE TABLE `feed_comments` (
  `comment_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `comment_post_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `comment_user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `comment_parent_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'NULL = top-level comment; otherwise a reply to comment_id (one level deep)',
  `comment_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `comment_status` enum('1','-99') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '1' COMMENT '1=active,-99=deleted',
  `comment_dateAdded` bigint UNSIGNED NOT NULL DEFAULT (unix_timestamp())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `feed_comments`
--
ALTER TABLE `feed_comments`
  ADD PRIMARY KEY (`comment_id`),
  ADD KEY `idx_comment_post` (`comment_post_id`,`comment_status`,`comment_dateAdded`),
  ADD KEY `idx_comment_parent` (`comment_parent_id`),
  ADD KEY `fk_comment_user` (`comment_user_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `feed_comments`
--
ALTER TABLE `feed_comments`
  ADD CONSTRAINT `fk_comment_post` FOREIGN KEY (`comment_post_id`) REFERENCES `feed_posts` (`post_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_comment_user` FOREIGN KEY (`comment_user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_comment_parent` FOREIGN KEY (`comment_parent_id`) REFERENCES `feed_comments` (`comment_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
