DROP TABLE IF EXISTS `users_interests`;
CREATE TABLE `users_interests` (
  `id_ai` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `interests_variant_ref_id` int NOT NULL,
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_ai`),
  KEY `fk_interests_user_id` (`user_id`),
  KEY `fk_interests_variant_id_ref` (`interests_variant_ref_id`),
  CONSTRAINT `fk_interests_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_interests_variant_id_ref` FOREIGN KEY (`interests_variant_ref_id`) REFERENCES `interests_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

