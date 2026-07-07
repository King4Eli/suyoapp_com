DROP TABLE IF EXISTS `users_prompt`;
CREATE TABLE `users_prompt` (
  `id_ai` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `prompts_variant_ref_id` bigint NOT NULL,
  `answer` varchar(100) NOT NULL,
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_ai`),
  KEY `fk_prompt_user_id` (`user_id`),
  KEY `fk_prompts_variant_id` (`prompts_variant_ref_id`),
  CONSTRAINT `fk_prompt_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_prompts_variant_id` FOREIGN KEY (`prompts_variant_ref_id`) REFERENCES `prompts_variant` (`id_ai`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

