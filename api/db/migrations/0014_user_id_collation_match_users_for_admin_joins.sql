-- Same problem 0009 fixed for users_locations: users.user_id is utf8mb4_general_ci,
-- but tables created since default to utf8mb4_0900_ai_ci, and MySQL refuses to
-- compare the two ("Illegal mix of collations"). The admin verifications page joins
-- user_verifications.user_id = users.user_id, hit that error and showed an empty
-- list. Align every such user_id now so the next join doesn't break. MODIFY is safe
-- to re-run.
ALTER TABLE `user_verifications` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;--> statement-breakpoint
ALTER TABLE `user_payment_notices` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;--> statement-breakpoint
ALTER TABLE `user_boost_usage` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;--> statement-breakpoint
ALTER TABLE `user_direct_message_usage` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;
