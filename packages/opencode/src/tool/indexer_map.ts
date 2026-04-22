import z from "zod"
import { Effect } from "effect"
import { Indexer } from "../indexer/indexer"
import DESCRIPTION from "./indexer_map.txt"
import * as Tool from "./tool"

export const IndexerMapTool = Tool.define(
  "indexer_map",
  Effect.gen(function* () {
    const indexer = yield* Indexer.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        path: z.string().describe("The directory path to start the map from (relative to worktree)"),
        depth: z.number().default(1).describe("The depth of the tree to return"),
      }),
      execute: (params: { path: string; depth: number }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "indexer",
            patterns: ["*"],
            always: ["*"],
            metadata: params,
          })

          const tree = yield* indexer.getMap(params.path, params.depth)
          return {
            title: `Map of ${params.path}`,
            metadata: { path: params.path, depth: params.depth },
            output: JSON.stringify(tree, null, 2),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
