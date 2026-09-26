CREATE TABLE IF NOT EXISTS `user_verifications` (
	`id` varchar(50) NOT NULL,
	`user_id` varchar(50) NOT NULL,
	`selfie_path` varchar(255) NOT NULL,
	`pose` varchar(40) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 0,
	`reject_reason` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`reviewed_at` timestamp,
	CONSTRAINT `user_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_verifications_user` ON `user_verifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_verifications_status` ON `user_verifications` (`status`);