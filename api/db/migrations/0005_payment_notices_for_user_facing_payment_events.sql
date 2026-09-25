CREATE TABLE IF NOT EXISTS `user_payment_notices` (
	`id` varchar(50) NOT NULL,
	`user_id` varchar(50) NOT NULL,
	`kind` varchar(40) NOT NULL,
	`tone` varchar(10) NOT NULL DEFAULT 'info',
	`title` varchar(120) NOT NULL,
	`body` varchar(500) NOT NULL,
	`payment_id` varchar(50),
	`seen` tinyint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_payment_notices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_payment_notices_user_seen` ON `user_payment_notices` (`user_id`,`seen`);