import z from "zod"
import { Effect } from "effect"
import { Indexer } from "../indexer/indexer"
import DESCRIPTION from "./indexer_note_update.txt"
import * as Tool from "./tool"

export const IndexerNoteUpdateTool = Tool.define(
  "indexer_note_update",
  Effect.gen(function* () {
    const indexer = yield* Indexer.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        id: z.string().describe("The ID of the note to update"),
        content: z.string().describe("The new content of the note (markdown)"),
        tags: z.array(z.string()).optional().describe("Optional new tags for the note"),
      }),
      execute: (params: { id: string; content: string; tags?: string[] }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "indexer",
            patterns: ["*"],
            always: ["*"],
            metadata: params,
          })

          yield* indexer.updateNote(params.id, params.content, params.tags)
          return {
            title: `Updated note ${params.id}`,
            metadata: { id: params.id },
            output: "Note updated successfully.",
          }
        }).pipe(Effect.orDie),
    }
  }),
)
