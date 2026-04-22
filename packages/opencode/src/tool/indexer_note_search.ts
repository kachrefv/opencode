import z from "zod"
import { Effect } from "effect"
import { Indexer } from "../indexer/indexer"
import DESCRIPTION from "./indexer_note_search.txt"
import * as Tool from "./tool"

export const IndexerNoteSearchTool = Tool.define(
  "indexer_note_search",
  Effect.gen(function* () {
    const indexer = yield* Indexer.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        query: z.string().describe("The search query"),
        tags: z.array(z.string()).optional().describe("Optional tags to filter by"),
      }),
      execute: (params: { query: string; tags?: string[] }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "indexer",
            patterns: ["*"],
            always: ["*"],
            metadata: params,
          })

          const results = yield* indexer.searchNotes(params.query, params.tags)
          return {
            title: `Search results for "${params.query}"`,
            metadata: { query: params.query },
            output: JSON.stringify(results, null, 2),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
