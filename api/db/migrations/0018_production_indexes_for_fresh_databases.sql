-- The schema never declared most of production's indexes, so a fresh database
-- (a new environment, the API tests) had none of them -- including the UNIQUE
-- ones the code relies on: one account per phone number / email, one row per
-- device, one match row per pair, one reaction per user per post. Production
-- already has every index below, so each is created only if an index with that
-- name doesn't exist yet: on production every statement is a no-op.
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_convo_match_id` ON `conversations` (`convo_match_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND INDEX_NAME = 'fk_convo_match_id');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_comment_user` ON `feed_comments` (`comment_user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_comments' AND INDEX_NAME = 'fk_comment_user');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_comment_parent` ON `feed_comments` (`comment_parent_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_comments' AND INDEX_NAME = 'idx_comment_parent');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_comment_post` ON `feed_comments` (`comment_post_id`, `comment_status`, `comment_dateAdded`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_comments' AND INDEX_NAME = 'idx_comment_post');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_post_feed_order` ON `feed_posts` (`post_status`, `post_dateAdded`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_posts' AND INDEX_NAME = 'idx_post_feed_order');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_post_user` ON `feed_posts` (`post_user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_posts' AND INDEX_NAME = 'idx_post_user');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_reaction_user` ON `feed_reactions` (`reaction_user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_reactions' AND INDEX_NAME = 'fk_reaction_user');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE UNIQUE INDEX `idx_reaction_unique` ON `feed_reactions` (`reaction_post_id`, `reaction_user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feed_reactions' AND INDEX_NAME = 'idx_reaction_unique');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `code` ON `gn_education_variant` (`code`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gn_education_variant' AND INDEX_NAME = 'code');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `code` ON `gn_ethnicity_variant` (`code`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gn_ethnicity_variant' AND INDEX_NAME = 'code');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `code` ON `gn_intent_variant` (`code`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gn_intent_variant' AND INDEX_NAME = 'code');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `code` ON `gn_language_variant` (`code`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gn_language_variant' AND INDEX_NAME = 'code');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `code` ON `gn_politicalview_variant` (`code`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gn_politicalview_variant' AND INDEX_NAME = 'code');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_iap_payment_id_ref` ON `iap_transactions` (`payment_id_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'iap_transactions' AND INDEX_NAME = 'fk_iap_payment_id_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_iap_user_id_ref` ON `iap_transactions` (`user_id_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'iap_transactions' AND INDEX_NAME = 'fk_iap_user_id_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_iap_variant_id_ref` ON `iap_transactions` (`variant_id_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'iap_transactions' AND INDEX_NAME = 'fk_iap_variant_id_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_report_user` ON `logs_application` (`report_currentuser`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs_application' AND INDEX_NAME = 'fk_report_user');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_report_device` ON `logs_application` (`device_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs_application' AND INDEX_NAME = 'idx_report_device');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE UNIQUE INDEX `map_type` ON `mapping_lookup` (`map_type`, `map_code`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mapping_lookup' AND INDEX_NAME = 'map_type');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_last_message` ON `matches` (`last_message_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND INDEX_NAME = 'fk_last_message');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE UNIQUE INDEX `idx_match_userid_pair` ON `matches` (`match_user_id_from`, `match_user_id_to`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND INDEX_NAME = 'idx_match_userid_pair');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE UNIQUE INDEX `idx_match_userid_pair_reverse` ON `matches` (`match_user_id_to`, `match_user_id_from`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND INDEX_NAME = 'idx_match_userid_pair_reverse');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_userid_ref` ON `payments` (`user_id_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'fk_userid_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_variant_ref` ON `payments` (`variant_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'fk_variant_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_user_status` ON `payments` (`user_id_ref`, `status`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_user_status');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `status` ON `payments` (`status`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'status');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `product_list_variant_fk` ON `product_list_variant` (`product_lists_id_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_list_variant' AND INDEX_NAME = 'product_list_variant_fk');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_payment_id_ref` ON `subscriptions` (`payment_id_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'fk_payment_id_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_user_id_ref` ON `subscriptions` (`user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'fk_user_id_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_variant_id_ref` ON `subscriptions` (`variant_id_ref`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'fk_variant_id_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_active` ON `users` (`user_active`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_active');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_dob` ON `users` (`user_bio_dob`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_dob');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `idx_gender` ON `users` (`user_bio_gender`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_gender');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE UNIQUE INDEX `user_email` ON `users` (`user_email`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'user_email');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `user_geo_hash` ON `users` (`geo_hash`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'user_geo_hash');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE UNIQUE INDEX `user_phonenumber` ON `users` (`user_phonenumber`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'user_phonenumber');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_userid_device` ON `users_devices` (`user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_devices' AND INDEX_NAME = 'fk_userid_device');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE UNIQUE INDEX `uq_device_id` ON `users_devices` (`device_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_devices' AND INDEX_NAME = 'uq_device_id');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_interests_user_id` ON `users_interests` (`user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_interests' AND INDEX_NAME = 'fk_interests_user_id');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_interests_variant_id_ref` ON `users_interests` (`interests_variant_ref_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_interests' AND INDEX_NAME = 'fk_interests_variant_id_ref');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_prompt_user_id` ON `users_prompt` (`user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_prompt' AND INDEX_NAME = 'fk_prompt_user_id');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_prompts_variant_id` ON `users_prompt` (`prompts_variant_ref_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_prompt' AND INDEX_NAME = 'fk_prompts_variant_id');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_reportedpost_id` ON `users_reported` (`reported_post_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_reported' AND INDEX_NAME = 'fk_reportedpost_id');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_reporter_userid` ON `users_reported` (`reporter_user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_reported' AND INDEX_NAME = 'fk_reporter_userid');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
--> statement-breakpoint
SET @stmt = (SELECT IF(COUNT(*) > 0, 'DO 0', 'CREATE INDEX `fk_userid_reported` ON `users_reported` (`user_id`)') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_reported' AND INDEX_NAME = 'fk_userid_reported');
--> statement-breakpoint
PREPARE index_fix FROM @stmt;
--> statement-breakpoint
EXECUTE index_fix;
--> statement-breakpoint
DEALLOCATE PREPARE index_fix;
