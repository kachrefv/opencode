ALTER TABLE `indexer_node` ADD `id` text;--> statement-breakpoint
ALTER TABLE `indexer_node` ADD `workspace` text NOT NULL;--> statement-breakpoint
ALTER TABLE `indexer_note` ADD `workspace` text NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_indexer_note` (
	`id` text PRIMARY KEY,
	`workspace` text NOT NULL,
	`file_path` text NOT NULL,
	`content` text NOT NULL,
	`tags` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_indexer_note`(`id`, `file_path`, `content`, `tags`, `time_created`, `time_updated`) SELECT `id`, `file_path`, `content`, `tags`, `time_created`, `time_updated` FROM `indexer_note`;--> statement-breakpoint
DROP TABLE `indexer_note`;--> statement-breakpoint
ALTER TABLE `__new_indexer_note` RENAME TO `indexer_note`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_indexer_node` (
	`id` text PRIMARY KEY,
	`workspace` text NOT NULL,
	`path` text NOT NULL,
	`parent_path` text,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_indexer_node`(`path`, `parent_path`, `type`, `size`, `time_created`, `time_updated`) SELECT `path`, `parent_path`, `type`, `size`, `time_created`, `time_updated` FROM `indexer_node`;--> statement-breakpoint
DROP TABLE `indexer_node`;--> statement-breakpoint
ALTER TABLE `__new_indexer_node` RENAME TO `indexer_node`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `indexer_node_parent_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `indexer_note_file_idx`;--> statement-breakpoint
CREATE INDEX `indexer_note_workspace_file_idx` ON `indexer_note` (`workspace`,`file_path`);--> statement-breakpoint
CREATE INDEX `indexer_node_workspace_parent_idx` ON `indexer_node` (`workspace`,`parent_path`);--> statement-breakpoint
CREATE INDEX `indexer_node_workspace_path_idx` ON `indexer_node` (`workspace`,`path`);