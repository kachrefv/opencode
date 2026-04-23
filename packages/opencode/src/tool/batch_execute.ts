import * as Tool from "./tool"
import DESCRIPTION from "./batch_execute.txt"
import z from "zod"
import { Effect } from "effect"

import type { Service as ToolRegistryService } from "./registry"

const id = "batch_execute"

const parameters = z.object({
  calls: z
    .array(
      z.object({
        tool: z.string().describe("The name of the tool to execute"),
        parameters: z.record(z.string(), z.any()).describe("The parameters to pass to the tool"),
      }),
    )
    .describe("The list of tools to execute concurrently"),
})

export const BatchExecuteTool = Tool.define(
  id,
  Effect.gen(function* () {
      const execute = Effect.fn("BatchExecuteTool.execute")(function* (params: z.infer<typeof parameters>, ctx: Tool.Context) {
        const { Service: ToolRegistry } = yield* Effect.promise(() => import("./registry"))
        const registry = yield* ToolRegistry
        const allTools = yield* registry.all()

        const executionEffects = params.calls.map((call, index) => {
          const toolDef = allTools.find((t) => t.id === call.tool)
          if (!toolDef) {
            return Effect.succeed({ index, error: `Tool ${call.tool} not found.` })
          }

          return Effect.gen(function* () {
            let parsedArgs
            try {
              parsedArgs = yield* Effect.try({
                try: () => toolDef.parameters.parse(call.parameters),
                catch: (e) => new Error(`Validation failed for tool ${call.tool}: ${String(e)}`),
              })
            } catch (e) {
              return { index, error: String(e) }
            }

            const result = yield* toolDef.execute(parsedArgs, ctx)
            return { index, result: result.output, metadata: result.metadata }
          }).pipe(
            Effect.catchDefect((defect) => Effect.succeed({ index, error: `Defect in ${call.tool}: ${String(defect)}` })),
            Effect.catchCause((err) => Effect.succeed({ index, error: `Error in ${call.tool}: ${String(err)}` }))
          )
        })

        const results = yield* Effect.all(executionEffects, { concurrency: "unbounded" })

        return {
          title: "Batch Execute",
          metadata: {},
          output: JSON.stringify(results, null, 2),
        }
      })

      return {
        parameters,
        description: DESCRIPTION,
        execute: execute as any,
      }
    })
)


