ALTER TABLE `users` ADD `user_notify_email_likes` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_email_matches` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_email_messages` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_email_promotions` enum('0','1') DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_email_announcements` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_push_likes` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_push_matches` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_push_messages` enum('0','1') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_push_promotions` enum('0','1') DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `user_notify_push_announcements` enum('0','1') DEFAULT '1' NOT NULL;