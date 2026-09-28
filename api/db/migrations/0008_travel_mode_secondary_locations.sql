CREATE TABLE IF NOT EXISTS `users_locations` (
	`id_ai` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(50) NOT NULL,
	`geo_meta` json NOT NULL,
	`geo_hash` varchar(12) NOT NULL,
	`geo_long` double NOT NULL,
	`geo_latd` double NOT NULL,
	`date_created` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_locations_id_ai` PRIMARY KEY(`id_ai`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `user_travel_mode` enum('0','1') DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE INDEX `users_locations_user` ON `users_locations` (`user_id`);--> statement-breakpoint
CREATE INDEX `users_locations_geo_hash` ON `users_locations` (`geo_hash`);