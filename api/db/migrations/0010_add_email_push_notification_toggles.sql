ALTER TABLE `users` ADD `user_notify_email` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_push` enum('0','1') DEFAULT '1' NOT NULL;