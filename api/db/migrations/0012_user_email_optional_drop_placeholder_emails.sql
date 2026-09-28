ALTER TABLE `users` MODIFY COLUMN `user_email` varchar(250);--> statement-breakpoint
-- Signup used to store a <phone>@example.com placeholder; no email is now NULL.
UPDATE `users` SET `user_email` = NULL WHERE `user_email` LIKE '%@example.com';
