CREATE TABLE IF NOT EXISTS `user_direct_message_usage` (
	`user_id` varchar(50) NOT NULL,
	`direct_message_balance` int NOT NULL DEFAULT 0,
	`daily_used` int NOT NULL DEFAULT 0,
	`daily_reset_date` date NOT NULL DEFAULT (curdate()),
	CONSTRAINT `user_direct_message_usage_user_id` PRIMARY KEY(`user_id`)
);
