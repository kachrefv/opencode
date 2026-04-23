CREATE TABLE `indexer_node` (
	`path` text PRIMARY KEY,
	`parent_path` text,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `indexer_note` (
	`id` text PRIMARY KEY,
	`file_path` text NOT NULL,
	`content` text NOT NULL,
	`tags` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_indexer_note_file_path_indexer_node_path_fk` FOREIGN KEY (`file_path`) REFERENCES `indexer_node`(`path`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `indexer_node_parent_idx` ON `indexer_node` (`parent_path`);--> statement-breakpoint
CREATE INDEX `indexer_note_file_idx` ON `indexer_note` (`file_path`);