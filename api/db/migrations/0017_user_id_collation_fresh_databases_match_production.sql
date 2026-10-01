-- Fresh databases (new environments, the API tests) didn't match production.
-- Production's original tables use utf8mb4_general_ci for every user id; the
-- 0000 baseline creates them with the server default (utf8mb4_0900_ai_ci), and
-- 0009/0014 then forced some user_id columns to general_ci to match production
-- -- so on a fresh database users.user_id and user_verifications.user_id end up
-- different, and joins between them fail ("Illegal mix of collations").
-- Each column is only altered if it isn't general_ci already, so on production
-- (where all of these already are) every statement is a no-op.
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `feed_comments` MODIFY `comment_user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_comments' AND COLUMN_NAME = 'comment_user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `feed_posts` MODIFY `post_user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_posts' AND COLUMN_NAME = 'post_user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `feed_reactions` MODIFY `reaction_user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_reactions' AND COLUMN_NAME = 'reaction_user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `iap_transactions` MODIFY `user_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'iap_transactions' AND COLUMN_NAME = 'user_id_ref');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `logs_application` MODIFY `report_currentuser` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs_application' AND COLUMN_NAME = 'report_currentuser');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `matches` MODIFY `match_user_id_from` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'match_user_id_from');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `matches` MODIFY `match_user_id_to` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'match_user_id_to');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `payments` MODIFY `user_id_ref` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'user_id_ref');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `subscriptions` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `user_rose_usage` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_rose_usage' AND COLUMN_NAME = 'user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `users` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `users_devices` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_devices' AND COLUMN_NAME = 'user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `users_interests` MODIFY `user_id` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_interests' AND COLUMN_NAME = 'user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `users_prompt` MODIFY `user_id` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_prompt' AND COLUMN_NAME = 'user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `users_reported` MODIFY `reporter_user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_reported' AND COLUMN_NAME = 'reporter_user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COLLATION_NAME = 'utf8mb4_general_ci', 'DO 0', 'ALTER TABLE `users_reported` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_reported' AND COLUMN_NAME = 'user_id');
--> statement-breakpoint
PREPARE collation_fix FROM @stmt;
--> statement-breakpoint
EXECUTE collation_fix;
--> statement-breakpoint
DEALLOCATE PREPARE collation_fix;
