-- Run against the live database -- this repo has no migration runner, `users.sql` is a
-- point-in-time dump, not applied automatically. This mirrors that dump's CREATE TABLE change.
ALTER TABLE `users`
  ADD COLUMN `user_privacy_read_receipts` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0'
    COMMENT 'VIP-only; mutual -- both sides must have this on to see each others read receipts'
  AFTER `user_privacy_incognito`;
