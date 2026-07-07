DROP TABLE IF EXISTS `prompts_variant`;
CREATE TABLE `prompts_variant` (
  `id_ai` bigint NOT NULL AUTO_INCREMENT,
  `question` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_ai`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('1', 'My ideal weekend looks like...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('2', 'A random fact about me is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('3', 'The quickest way to my heart is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('4', 'I get along best with people who...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('5', 'My biggest green flag is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('6', 'My biggest red flag is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('7', 'I will fall for you if...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('8', 'My love language is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('9', 'The last thing that made me laugh was...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('10', 'My toxic trait is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('11', 'I am overly competitive about...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('12', 'The one thing you should know about me is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('13', 'I spend too much time thinking about...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('14', 'A perfect first date would be...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('15', 'The most spontaneous thing I have done is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('16', 'My favorite way to relax is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('17', 'I am known for...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('18', 'My go-to comfort food is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('19', 'I am currently obsessed with...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('20', 'The best trip I ever took was...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('21', 'I want someone who...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('22', 'I can not stand people who...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('23', 'My hidden talent is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('24', 'The way to impress me is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('25', 'I wish more people knew that...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('26', 'My biggest turn on is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('27', 'My biggest turn off is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('28', 'I would never...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('29', 'My dream life looks like...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('30', 'The best advice I have received is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('31', 'I am looking for...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('32', 'We will get along if...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('33', 'You should not date me if...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('34', 'My vibe in one sentence is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('35', 'I bring to the table...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('36', 'My unpopular opinion is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('37', 'Something I learned recently is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('38', 'My guilty pleasure is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('39', 'I lose track of time when...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('40', 'My perfect night is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('41', 'I am weirdly good at...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('42', 'My friends would describe me as...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('43', 'The fastest way to win me over is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('44', 'I value most in a relationship...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('45', 'My biggest goal right now is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('46', 'I get excited about...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('47', 'I can talk for hours about...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('48', 'My biggest pet peeve is...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');
INSERT INTO `prompts_variant` (`id_ai`, `question`, `status`, `date_created`, `date_updated`) VALUES ('49', 'I feel most alive when...', '1', '2026-04-02 00:35:16', '2026-04-02 00:35:16');

