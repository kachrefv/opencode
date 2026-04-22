import z from "zod"
import { Effect } from "effect"
import { Indexer } from "../indexer/indexer"
import DESCRIPTION from "./indexer_note_list.txt"
import * as Tool from "./tool"

export const IndexerNoteListTool = Tool.define(
  "indexer_note_list",
  Effect.gen(function* () {
    const indexer = yield* Indexer.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        filePath: z.string().describe("The path of the file to list notes for"),
      }),
      execute: (params: { filePath: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "indexer",
            patterns: ["*"],
            always: ["*"],
            metadata: params,
          })

          const notes = yield* indexer.listNotes(params.filePath)
          return {
            title: `Notes for ${params.filePath}`,
            metadata: { filePath: params.filePath },
            output: JSON.stringify(notes, null, 2),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
