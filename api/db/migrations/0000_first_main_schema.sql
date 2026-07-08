CREATE TABLE `conversations` (
	`convo_id` varchar(50) NOT NULL,
	`convo_match_id` varchar(50) NOT NULL,
	`convo_message` longtext NOT NULL,
	`convo_by_initiator` enum('0','1') NOT NULL,
	`convo_status` enum('0','1','-99') NOT NULL DEFAULT '0',
	`convo_date_added` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	`convo_date_updated` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT `conversations_convo_id` PRIMARY KEY(`convo_id`)
);
--> statement-breakpoint
CREATE TABLE `feed_comments` (
	`comment_id` varchar(50) NOT NULL,
	`comment_post_id` varchar(50) NOT NULL,
	`comment_user_id` varchar(50) NOT NULL,
	`comment_parent_id` varchar(50),
	`comment_text` text NOT NULL,
	`comment_status` enum('1','-99') NOT NULL DEFAULT '1',
	`comment_dateAdded` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT `feed_comments_comment_id` PRIMARY KEY(`comment_id`)
);
--> statement-breakpoint
CREATE TABLE `feed_posts` (
	`post_id` varchar(50) NOT NULL,
	`post_user_id` varchar(50) NOT NULL,
	`post_caption` text,
	`post_media` json,
	`post_status` enum('1','-99') NOT NULL DEFAULT '1',
	`post_dateAdded` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	`post_dateUpdated` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT `feed_posts_post_id` PRIMARY KEY(`post_id`)
);
--> statement-breakpoint
CREATE TABLE `feed_reactions` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`reaction_post_id` varchar(50) NOT NULL,
	`reaction_user_id` varchar(50) NOT NULL,
	`reaction_kind` enum('like','love','haha','wow','celebrate','support') NOT NULL DEFAULT 'like',
	`reaction_dateAdded` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT `feed_reactions_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_education_variant` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`code` smallint NOT NULL,
	`label` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_education_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_ethnicity_variant` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`code` smallint NOT NULL,
	`label` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_ethnicity_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_intent_variant` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`code` smallint NOT NULL,
	`label` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_intent_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_interests_variant` (
	`id_ai` int AUTO_INCREMENT NOT NULL,
	`category` varchar(30) NOT NULL,
	`interested_in` varchar(50) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_interests_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_language_variant` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`code` smallint NOT NULL,
	`label` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_language_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_politicalview_variant` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`code` smallint NOT NULL,
	`label` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_politicalview_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_prompts_variant` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`question` varchar(255) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_prompts_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `gn_religion_variant` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`label` varchar(50) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gn_religion_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `iap_transactions` (
	`transaction_id` varchar(255) NOT NULL,
	`platform` tinyint NOT NULL,
	`product_id` varchar(200) NOT NULL,
	`variant_id_ref` int NOT NULL,
	`user_id_ref` varchar(50) NOT NULL,
	`payment_id_ref` varchar(50),
	`match_id_ref` varchar(50),
	`verification_mode` tinyint NOT NULL DEFAULT 0,
	`verification_response` json,
	`status` tinyint NOT NULL DEFAULT 0,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iap_transactions_transaction_id` PRIMARY KEY(`transaction_id`)
);
--> statement-breakpoint
CREATE TABLE `logs_application` (
	`report_id` varchar(50) NOT NULL,
	`report_type` varchar(30) NOT NULL DEFAULT 'undefined',
	`report_status` tinyint NOT NULL DEFAULT 0,
	`report_data` longtext NOT NULL,
	`report_currentuser` varchar(50),
	`device_id` varchar(191),
	`created_at` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	`updated_at` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT `logs_application_report_id` PRIMARY KEY(`report_id`)
);
--> statement-breakpoint
CREATE TABLE `mapping_lookup` (
	`map_id` int AUTO_INCREMENT NOT NULL,
	`map_type` enum('bio_interests','bio_religion','bundle_version','img_domain') NOT NULL,
	`map_code` tinyint NOT NULL,
	`map_label` text NOT NULL,
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mapping_lookup_map_id` PRIMARY KEY(`map_id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`match_id` varchar(50) NOT NULL,
	`match_user_id_from` varchar(50) NOT NULL,
	`match_user_id_to` varchar(50) NOT NULL,
	`match_status` enum('0','1','2','3','4','5') NOT NULL DEFAULT '0',
	`last_message_id` varchar(50),
	`match_dateAdded` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	`match_dateUpdated` bigint unsigned NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT `matches_match_id` PRIMARY KEY(`match_id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`payment_id` varchar(50) NOT NULL,
	`p_amount` decimal(10,2) NOT NULL,
	`p_currency` varchar(10) DEFAULT 'USD',
	`type` tinyint NOT NULL,
	`status` tinyint NOT NULL DEFAULT 0,
	`p_transaction_reference` varchar(255),
	`user_id_ref` varchar(50) NOT NULL,
	`variant_ref` int NOT NULL,
	`p_created_at` timestamp NOT NULL DEFAULT (now()),
	`p_updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_payment_id` PRIMARY KEY(`payment_id`)
);
--> statement-breakpoint
CREATE TABLE `product_list_variant` (
	`id_ai` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` json NOT NULL,
	`price` decimal(11,2) NOT NULL DEFAULT '0.00',
	`billing_cycle` tinyint NOT NULL DEFAULT 1,
	`product_lists_id_ref` varchar(200) NOT NULL,
	`active` enum('0','1') NOT NULL DEFAULT '0',
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`external_3rdparty_store_product_id` text NOT NULL,
	CONSTRAINT `product_list_variant_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `product_lists` (
	`pl_sku` varchar(200) NOT NULL,
	`pl_name` varchar(200) NOT NULL,
	`pl_description` json NOT NULL,
	`category` varchar(15) NOT NULL,
	`pl_is_active` enum('0','1') NOT NULL,
	`pl_created` timestamp NOT NULL,
	`pl_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_lists_pl_sku` PRIMARY KEY(`pl_sku`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`event_id` varchar(100) NOT NULL,
	`event_type` varchar(100),
	`processed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_events_event_id` PRIMARY KEY(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` varchar(50) NOT NULL,
	`user_id` varchar(50) NOT NULL,
	`variant_id_ref` int NOT NULL,
	`start_date` timestamp NOT NULL DEFAULT (now()),
	`end_date` timestamp NOT NULL,
	`external_platform` tinyint NOT NULL,
	`external_id` varchar(200) NOT NULL,
	`payment_id_ref` varchar(50),
	`status` tinyint NOT NULL,
	`cancel_at_period_end` tinyint NOT NULL DEFAULT 0,
	`canceled_at` timestamp,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_modified` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_rose_usage` (
	`user_id` varchar(50) NOT NULL,
	`rose_balance` int NOT NULL DEFAULT 0,
	`daily_used` int NOT NULL DEFAULT 0,
	`daily_reset_date` date NOT NULL DEFAULT (curdate()),
	CONSTRAINT `user_rose_usage_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`autoIncrement` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(50) NOT NULL,
	`user_email` varchar(250) NOT NULL,
	`user_phonenumber` varchar(15) NOT NULL,
	`user_phonenumber_meta` json,
	`user_fullname` text NOT NULL,
	`user_image` longtext,
	`user_active` enum('0','1','2','3','-99') NOT NULL DEFAULT '1',
	`geo_meta` json NOT NULL,
	`geo_hash` varchar(12) NOT NULL,
	`geo_long` double NOT NULL,
	`geo_latd` double NOT NULL,
	`user_verified` enum('0','1') NOT NULL DEFAULT '0',
	`user_datecreated` timestamp NOT NULL DEFAULT (now()),
	`user_last_accessed` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`user_signedup_device_stats` text NOT NULL,
	`user_bio_highesteducation` tinyint,
	`user_bio_relationshipgoal` tinyint,
	`user_bio_schoolattended` varchar(50),
	`user_bio_politicalview` tinyint,
	`user_bio_hometown` varchar(50),
	`user_bio_language` longtext,
	`user_bio_company` varchar(30),
	`user_bio_ethnicity` tinyint,
	`user_bio_smoking` enum('0','1','2') NOT NULL,
	`user_bio_drinking` enum('0','1','2') NOT NULL,
	`user_bio_children` enum('0','1') NOT NULL,
	`user_bio_religion` tinyint,
	`user_bio_jobrole` varchar(20),
	`user_bio_gender` int NOT NULL,
	`user_bio_haspet` enum('0','1') NOT NULL,
	`user_bio_about` varchar(400) NOT NULL,
	`user_bio_height` int,
	`user_bio_dob` varchar(8) NOT NULL,
	`user_preference_minimum_age` tinyint NOT NULL DEFAULT 18,
	`user_preference_maximum_age` tinyint NOT NULL DEFAULT 25,
	`user_preference_highesteducation` tinyint NOT NULL DEFAULT -99,
	`user_preference_height_minimum` int NOT NULL DEFAULT 153,
	`user_preference_height_maximum` int NOT NULL DEFAULT 180,
	`user_preference_relationshipgoal` tinyint NOT NULL DEFAULT -99,
	`user_preference_ethnicity` tinyint NOT NULL DEFAULT -99,
	`user_preference_smoking` enum('0','1','2','-99') NOT NULL DEFAULT '-99',
	`user_preference_distance` int NOT NULL DEFAULT 55,
	`user_preference_drinking` enum('0','1','2','-99') NOT NULL DEFAULT '-99',
	`user_preference_children` enum('0','1','-99') NOT NULL DEFAULT '-99',
	`user_preference_gender` tinyint NOT NULL DEFAULT -99,
	`user_preference_pet` enum('0','1','-99') NOT NULL DEFAULT '-99',
	`user_preference_religion` tinyint NOT NULL DEFAULT -99,
	`user_preference_politicalview` tinyint NOT NULL DEFAULT -99,
	`user_preference_language` longtext,
	`user_settings` longtext NOT NULL,
	`user_privacy_show_distance` enum('0','1') NOT NULL DEFAULT '1',
	`user_privacy_show_age` enum('0','1') NOT NULL DEFAULT '1',
	`user_privacy_incognito` enum('0','1') NOT NULL DEFAULT '0',
	`user_privacy_read_receipts` enum('0','1') NOT NULL DEFAULT '0',
	`user_bio_social_links` longtext,
	CONSTRAINT `users_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `users_autoIncrement_unique` UNIQUE(`autoIncrement`)
);
--> statement-breakpoint
CREATE TABLE `users_devices` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(50) NOT NULL,
	`device_id` varchar(191) NOT NULL,
	`device_name` varchar(150),
	`device_model` varchar(100),
	`device_brand` varchar(100),
	`device_type` varchar(30),
	`manufacturer` varchar(100),
	`device_os` varchar(100),
	`carrier` varchar(100),
	`user_agent` varchar(255),
	`screen_width` smallint unsigned,
	`screen_height` smallint unsigned,
	`is_emulator` tinyint NOT NULL DEFAULT 0,
	`app_version` varchar(30),
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_mod` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_devices_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `users_interests` (
	`id_ai` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(250) NOT NULL,
	`interests_variant_ref_id` int NOT NULL,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_interests_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `users_prompt` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(250) NOT NULL,
	`prompts_variant_ref_id` bigint NOT NULL,
	`answer` varchar(100) NOT NULL,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_prompt_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
CREATE TABLE `users_reported` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(50) NOT NULL,
	`reporter_user_id` varchar(50),
	`reported_post_id` varchar(50),
	`status` tinyint NOT NULL DEFAULT 0,
	`reason` text NOT NULL,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	`date_mod` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_reported_id_ai` PRIMARY KEY(`id_ai`)
);
