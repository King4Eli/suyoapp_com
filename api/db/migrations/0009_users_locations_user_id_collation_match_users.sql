-- users.user_id is utf8mb4_general_ci but new tables default to utf8mb4_0900_ai_ci, and
-- MySQL refuses to compare the two ("Illegal mix of collations") -- discovery joins
-- users_locations.user_id = users.user_id, so they must match. Drizzle's schema can't
-- express a column collation, hence a custom migration. MODIFY is safe to re-run.
ALTER TABLE `users_locations` MODIFY `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;
