CREATE TABLE IF NOT EXISTS `user_boost_usage` (
	`user_id` varchar(50) NOT NULL,
	`boost_balance` int NOT NULL DEFAULT 0,
	CONSTRAINT `user_boost_usage_user_id` PRIMARY KEY(`user_id`)
);
