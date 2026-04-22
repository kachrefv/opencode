import z from "zod"
import { Effect } from "effect"
import { Indexer } from "../indexer/indexer"
import DESCRIPTION from "./indexer_note_add.txt"
import * as Tool from "./tool"

export const IndexerNoteAddTool = Tool.define(
  "indexer_note_add",
  Effect.gen(function* () {
    const indexer = yield* Indexer.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        filePath: z.string().describe("The path of the file to attach the note to"),
        content: z.string().describe("The content of the note (markdown)"),
        tags: z.array(z.string()).optional().describe("Optional tags for the note"),
      }),
      execute: (params: { filePath: string; content: string; tags?: string[] }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "indexer",
            patterns: ["*"],
            always: ["*"],
            metadata: params,
          })

          yield* indexer.addNote(params.filePath, params.content, params.tags)
          return {
            title: `Added note to ${params.filePath}`,
            metadata: { filePath: params.filePath },
            output: "Note added successfully.",
          }
        }).pipe(Effect.orDie),
    }
  }),
)
