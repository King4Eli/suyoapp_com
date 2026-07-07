DROP TABLE IF EXISTS `interests_variant`;
CREATE TABLE `interests_variant` (
  `id_ai` int NOT NULL AUTO_INCREMENT,
  `category` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `interested_in` varchar(50) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_ai`)
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('1', 'Gaming & Technology', 'xbox', '1', '2026-04-01 23:50:42', '2026-04-01 23:50:42');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('2', 'Gaming & Technology', 'ps5', '1', '2026-04-01 23:50:42', '2026-04-01 23:50:42');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('3', 'Gaming & Technology', 'xbox', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('4', 'Gaming & Technology', 'ps5', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('5', 'Gaming & Technology', 'pc gaming', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('6', 'Gaming & Technology', 'nintendo switch', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('7', 'Gaming & Technology', 'vr gaming', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('8', 'Gaming & Technology', 'mobile gaming', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('9', 'Gaming & Technology', 'esports', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('10', 'Gaming & Technology', 'coding', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('11', 'Gaming & Technology', 'ai', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('12', 'Gaming & Technology', 'blockchain', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('13', 'Gaming & Technology', 'cybersecurity', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('14', 'Gaming & Technology', 'gadgets', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('15', 'Gaming & Technology', 'tech reviews', '1', '2026-04-01 23:58:47', '2026-04-01 23:58:47');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('16', 'Fitness & Health', 'gym', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('17', 'Fitness & Health', 'weightlifting', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('18', 'Fitness & Health', 'running', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('19', 'Fitness & Health', 'yoga', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('20', 'Fitness & Health', 'pilates', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('21', 'Fitness & Health', 'crossfit', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('22', 'Fitness & Health', 'cycling', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('23', 'Fitness & Health', 'boxing', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('24', 'Fitness & Health', 'martial arts', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('25', 'Fitness & Health', 'nutrition', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('26', 'Fitness & Health', 'meditation', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('27', 'Fitness & Health', 'wellness', '1', '2026-04-01 23:59:04', '2026-04-01 23:59:04');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('28', 'Music & Entertainment', 'hip hop', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('29', 'Music & Entertainment', 'rap', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('30', 'Music & Entertainment', 'r&b', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('31', 'Music & Entertainment', 'pop', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('32', 'Music & Entertainment', 'rock', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('33', 'Music & Entertainment', 'jazz', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('34', 'Music & Entertainment', 'edm', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('35', 'Music & Entertainment', 'concerts', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('36', 'Music & Entertainment', 'djing', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('37', 'Music & Entertainment', 'karaoke', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('38', 'Music & Entertainment', 'podcasts', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('39', 'Music & Entertainment', 'streaming', '1', '2026-04-01 23:59:48', '2026-04-01 23:59:48');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('40', 'Food & Drink', 'cooking', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('41', 'Food & Drink', 'baking', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('42', 'Food & Drink', 'fine dining', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('43', 'Food & Drink', 'street food', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('44', 'Food & Drink', 'vegan', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('45', 'Food & Drink', 'bbq', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('46', 'Food & Drink', 'wine', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('47', 'Food & Drink', 'coffee', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('48', 'Food & Drink', 'craft beer', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('49', 'Food & Drink', 'cocktails', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('50', 'Food & Drink', 'food festivals', '1', '2026-04-02 00:00:01', '2026-04-02 00:00:01');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('51', 'Travel & Lifestyle', 'traveling', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('52', 'Travel & Lifestyle', 'road trips', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('53', 'Travel & Lifestyle', 'luxury travel', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('54', 'Travel & Lifestyle', 'backpacking', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('55', 'Travel & Lifestyle', 'beach', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('56', 'Travel & Lifestyle', 'mountains', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('57', 'Travel & Lifestyle', 'photography', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('58', 'Travel & Lifestyle', 'blogging', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('59', 'Travel & Lifestyle', 'shopping', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('60', 'Travel & Lifestyle', 'fashion', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('61', 'Travel & Lifestyle', 'nightlife', '1', '2026-04-02 00:00:08', '2026-04-02 00:00:08');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('62', 'Sports', 'basketball', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('63', 'Sports', 'football', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('64', 'Sports', 'soccer', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('65', 'Sports', 'baseball', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('66', 'Sports', 'tennis', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('67', 'Sports', 'golf', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('68', 'Sports', 'swimming', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('69', 'Sports', 'skateboarding', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('70', 'Sports', 'surfing', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('71', 'Sports', 'hiking', '1', '2026-04-02 00:00:14', '2026-04-02 00:00:14');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('72', 'Social', 'partying', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('73', 'Social', 'chilling', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('74', 'Social', 'networking', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('75', 'Social', 'dating', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('76', 'Social', 'casual hangouts', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('77', 'Social', 'deep conversations', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('78', 'Social', 'adventures', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('79', 'Social', 'spontaneous trips', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');
INSERT INTO `interests_variant` (`id_ai`, `category`, `interested_in`, `status`, `date_created`, `date_updated`) VALUES ('80', 'Social', 'late night drives', '1', '2026-04-02 00:00:22', '2026-04-02 00:00:22');

