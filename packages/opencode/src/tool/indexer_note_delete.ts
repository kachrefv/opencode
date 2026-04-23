import z from "zod"
import { Effect } from "effect"
import { Indexer } from "../indexer/indexer"
import DESCRIPTION from "./indexer_note_delete.txt"
import * as Tool from "./tool"

export const IndexerNoteDeleteTool = Tool.define(
  "indexer_note_delete",
  Effect.gen(function* () {
    const indexer = yield* Indexer.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        id: z.string().describe("The ID of the note to delete"),
      }),
      execute: (params: { id: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "indexer",
            patterns: ["*"],
            always: ["*"],
            metadata: params,
          })

          yield* indexer.deleteNote(params.id)
          return {
            title: `Deleted note ${params.id}`,
            metadata: { id: params.id },
            output: "Note deleted successfully.",
          }
        }).pipe(Effect.orDie),
    }
  }),
)
