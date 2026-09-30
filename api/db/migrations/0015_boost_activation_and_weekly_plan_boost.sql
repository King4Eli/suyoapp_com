ALTER TABLE `user_boost_usage` ADD `weekly_boost_used_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `user_boosted_until` timestamp;