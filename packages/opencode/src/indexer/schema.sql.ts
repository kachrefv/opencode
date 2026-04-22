import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"

export const IndexerNodeTable = sqliteTable(
  "indexer_node",
  {
    id: text().primaryKey(), // Format: `${workspace}:${path}`
    workspace: text().default("global").notNull(),
    path: text().notNull(),
    parent_path: text(),
    type: text().$type<"file" | "dir" | "symlink">().notNull(),
    size: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    index("indexer_node_workspace_parent_idx").on(table.workspace, table.parent_path),
    index("indexer_node_workspace_path_idx").on(table.workspace, table.path),
  ],
)

export const IndexerNoteTable = sqliteTable(
  "indexer_note",
  {
    id: text().primaryKey(),
    workspace: text().default("global").notNull(),
    file_path: text().notNull(),
    content: text().notNull(),
    tags: text({ mode: "json" }).$type<string[]>(),
    ...Timestamps,
  },
  (table) => [
    index("indexer_note_workspace_file_idx").on(table.workspace, table.file_path),
  ],
)
