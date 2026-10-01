-- Logs now record the app version they were written by (pushLogReports.js).
-- users_devices.app_version is the device's current version, which moves on.
ALTER TABLE `logs_application` ADD `app_version` varchar(32);--> statement-breakpoint
-- Backfill from the app block already inside each client log's JSON; server
-- logs aren't JSON, so JSON reads are guarded by CASE WHEN JSON_VALID().
UPDATE `logs_application`
SET `app_version` = LEFT(CONCAT(
    JSON_UNQUOTE(JSON_EXTRACT(`report_data`, '$.app.version_app')),
    IFNULL(CONCAT(' (', JSON_UNQUOTE(JSON_EXTRACT(`report_data`, '$.app.buildNumber_app')), ')'), '')
  ), 32)
WHERE `app_version` IS NULL
  AND (CASE WHEN JSON_VALID(`report_data`) THEN JSON_EXTRACT(`report_data`, '$.app.version_app') END) IS NOT NULL;
