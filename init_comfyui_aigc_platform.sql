-- ComfyUI internal AIGC platform initialization SQL
-- Target: MySQL 8.x

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `comfyui_aigc_platform`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `comfyui_aigc_platform`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `username` VARCHAR(64) NOT NULL COMMENT 'Login username',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Password hash',
  `nickname` VARCHAR(64) NOT NULL COMMENT 'Display name',
  `email` VARCHAR(128) DEFAULT NULL COMMENT 'Email',
  `mobile` VARCHAR(32) DEFAULT NULL COMMENT 'Mobile number',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 enabled, 0 disabled',
  `last_login_at` DATETIME DEFAULT NULL COMMENT 'Last login time',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Users';

CREATE TABLE IF NOT EXISTS `roles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `code` VARCHAR(64) NOT NULL COMMENT 'Role code',
  `name` VARCHAR(64) NOT NULL COMMENT 'Role name',
  `description` VARCHAR(255) DEFAULT NULL COMMENT 'Description',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles';

CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `user_id` BIGINT NOT NULL COMMENT 'User id',
  `role_id` BIGINT NOT NULL COMMENT 'Role id',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_roles_user_role` (`user_id`, `role_id`),
  KEY `idx_user_roles_role_id` (`role_id`),
  CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User role mappings';

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `task_no` VARCHAR(64) NOT NULL COMMENT 'Platform task number',
  `user_id` BIGINT NOT NULL COMMENT 'Creator user id',
  `task_type` VARCHAR(32) NOT NULL COMMENT 'image/video/audio',
  `biz_type` VARCHAR(64) NOT NULL COMMENT 'txt2img/img2img/img2video/tts etc',
  `title` VARCHAR(128) DEFAULT NULL COMMENT 'Task title',
  `status` VARCHAR(32) NOT NULL COMMENT 'pending/queued/running/success/failed/cancelled',
  `progress` INT NOT NULL DEFAULT 0 COMMENT 'Progress 0-100',
  `input_params` JSON NOT NULL COMMENT 'Structured input params',
  `comfy_server` VARCHAR(255) DEFAULT NULL COMMENT 'ComfyUI server address',
  `comfy_workflow_name` VARCHAR(128) DEFAULT NULL COMMENT 'Workflow identifier',
  `comfy_task_id` VARCHAR(128) DEFAULT NULL COMMENT 'ComfyUI task id',
  `result_summary` JSON DEFAULT NULL COMMENT 'Result summary',
  `error_message` TEXT DEFAULT NULL COMMENT 'Error message',
  `started_at` DATETIME DEFAULT NULL COMMENT 'Task start time',
  `finished_at` DATETIME DEFAULT NULL COMMENT 'Task finish time',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tasks_task_no` (`task_no`),
  KEY `idx_tasks_user_id` (`user_id`),
  KEY `idx_tasks_status` (`status`),
  KEY `idx_tasks_task_type` (`task_type`),
  KEY `idx_tasks_biz_type` (`biz_type`),
  KEY `idx_tasks_created_at` (`created_at`),
  KEY `idx_tasks_user_created_at` (`user_id`, `created_at`),
  CONSTRAINT `fk_tasks_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_tasks_progress` CHECK (`progress` >= 0 AND `progress` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Generation tasks';

CREATE TABLE IF NOT EXISTS `task_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `task_id` BIGINT NOT NULL COMMENT 'Task id',
  `log_type` VARCHAR(32) NOT NULL COMMENT 'system/submit/polling/callback/result/error',
  `status` VARCHAR(32) DEFAULT NULL COMMENT 'Task status at log time',
  `message` VARCHAR(500) NOT NULL COMMENT 'Log summary',
  `detail` JSON DEFAULT NULL COMMENT 'Detailed payload',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  PRIMARY KEY (`id`),
  KEY `idx_task_logs_task_id` (`task_id`),
  KEY `idx_task_logs_log_type` (`log_type`),
  KEY `idx_task_logs_created_at` (`created_at`),
  KEY `idx_task_logs_task_created_at` (`task_id`, `created_at`),
  CONSTRAINT `fk_task_logs_task_id` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Task logs';

CREATE TABLE IF NOT EXISTS `assets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `user_id` BIGINT NOT NULL COMMENT 'Owner user id',
  `task_id` BIGINT DEFAULT NULL COMMENT 'Related task id',
  `asset_type` VARCHAR(32) NOT NULL COMMENT 'input/output/preview/thumbnail',
  `media_type` VARCHAR(32) NOT NULL COMMENT 'image/video/audio',
  `storage_provider` VARCHAR(32) NOT NULL DEFAULT 'minio' COMMENT 'minio/s3/oss/cos',
  `bucket_name` VARCHAR(128) DEFAULT NULL COMMENT 'Bucket name',
  `object_key` VARCHAR(500) NOT NULL COMMENT 'Object storage key',
  `file_name` VARCHAR(255) NOT NULL COMMENT 'Original file name',
  `mime_type` VARCHAR(128) DEFAULT NULL COMMENT 'Mime type',
  `file_size` BIGINT DEFAULT NULL COMMENT 'File size in bytes',
  `width` INT DEFAULT NULL COMMENT 'Width',
  `height` INT DEFAULT NULL COMMENT 'Height',
  `duration` DECIMAL(10,2) DEFAULT NULL COMMENT 'Duration in seconds',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT 'Sort order under task',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated time',
  PRIMARY KEY (`id`),
  KEY `idx_assets_user_id` (`user_id`),
  KEY `idx_assets_task_id` (`task_id`),
  KEY `idx_assets_asset_type` (`asset_type`),
  KEY `idx_assets_media_type` (`media_type`),
  KEY `idx_assets_task_asset_type` (`task_id`, `asset_type`),
  CONSTRAINT `fk_assets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_assets_task_id` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Input and output assets';

CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `config_key` VARCHAR(128) NOT NULL COMMENT 'Configuration key',
  `config_value` TEXT NOT NULL COMMENT 'Configuration value',
  `value_type` VARCHAR(32) NOT NULL DEFAULT 'string' COMMENT 'string/number/boolean/json',
  `description` VARCHAR(255) DEFAULT NULL COMMENT 'Description',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_configs_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='System configurations';

INSERT INTO `roles` (`code`, `name`, `description`)
VALUES
  ('admin', 'Administrator', 'Platform administrator'),
  ('user', 'User', 'Normal user')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

INSERT INTO `system_configs` (`config_key`, `config_value`, `value_type`, `description`)
VALUES
  ('comfyui.base_url', 'http://127.0.0.1:8188', 'string', 'ComfyUI base URL'),
  ('comfyui.timeout_ms', '300000', 'number', 'ComfyUI request timeout in milliseconds'),
  ('comfyui.poll_interval_ms', '3000', 'number', 'Polling interval in milliseconds'),
  ('storage.default_bucket', 'aigc-assets', 'string', 'Default object storage bucket'),
  ('task.default_retry_count', '1', 'number', 'Default retry count for failed tasks')
ON DUPLICATE KEY UPDATE
  `config_value` = VALUES(`config_value`),
  `value_type` = VALUES(`value_type`),
  `description` = VALUES(`description`);

SET FOREIGN_KEY_CHECKS = 1;

-- Optional seed admin user
-- Password should be replaced with a real bcrypt/argon2 hash before use.
-- INSERT INTO `users` (`username`, `password_hash`, `nickname`, `status`)
-- VALUES ('admin', 'REPLACE_WITH_HASH', 'Admin', 1);
