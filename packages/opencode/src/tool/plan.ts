import z from "zod"
import path from "path"
import os from "os"
import { Effect } from "effect"
import * as Tool from "./tool"
import { Question } from "../question"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Provider } from "../provider"
import { Instance } from "../project/instance"
import { type SessionID, MessageID, PartID } from "../session/schema"
import EXIT_DESCRIPTION from "./plan-exit.txt"
import ENTER_DESCRIPTION from "./plan-enter.txt"
import WRITE_DESCRIPTION from "./plan-write.txt"
import WALKTHROUGH_WRITE_DESCRIPTION from "./walkthrough-write.txt"
import { AppFileSystem } from "@opencode-ai/shared/filesystem"

function getLastModel(sessionID: SessionID) {
  for (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user" && item.info.model) return item.info.model
  }
  return undefined
}

export const PlanWriteTool = Tool.define(
  "plan_write",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: WRITE_DESCRIPTION,
      parameters: z.object({
        content: z.string().describe("The content to write to the implementation plan"),
      }),
      execute: (params: { content: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const planDir = path.join(os.tmpdir(), ctx.sessionID)
          const planFile = path.join(planDir, "implementation_plan.md")

          yield* fs.ensureDir(planDir)
          yield* fs.writeFileString(planFile, params.content)

          return {
            title: "Implementation Plan",
            output: `Successfully wrote implementation plan to ${planFile}`,
            metadata: { planFile },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const WalkthroughWriteTool = Tool.define(
  "walkthrough_write",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: WALKTHROUGH_WRITE_DESCRIPTION,
      parameters: z.object({
        content: z.string().describe("The content to write to the walkthrough"),
      }),
      execute: (params: { content: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const planDir = path.join(os.tmpdir(), ctx.sessionID)
          const walkthroughFile = path.join(planDir, "walkthrough.md")

          yield* fs.ensureDir(planDir)
          yield* fs.writeFileString(walkthroughFile, params.content)

          return {
            title: "Walkthrough",
            output: `Successfully wrote walkthrough to ${walkthroughFile}`,
            metadata: { walkthroughFile },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const PlanExitTool = Tool.define(
  "plan_exit",
  Effect.gen(function* () {
    const session = yield* Session.Service
    const question = yield* Question.Service
    const provider = yield* Provider.Service

    return {
      description: EXIT_DESCRIPTION,
      parameters: z.object({}),
      execute: (_params: {}, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const info = yield* session.get(ctx.sessionID)
          const plan = path.relative(Instance.worktree, Session.plan(info))
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: [
              {
                question: `Plan at ${plan} is complete. Would you like to switch to the build agent and start implementing?`,
                header: "Build Agent",
                custom: false,
                options: [
                  { label: "Yes", description: "Switch to build agent and start implementing the plan" },
                  { label: "No", description: "Stay with plan agent to continue refining the plan" },
                ],
              },
            ],
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          if (answers[0]?.[0] === "No") yield* new Question.RejectedError()

          const model = getLastModel(ctx.sessionID) ?? (yield* provider.defaultModel())

          const msg: MessageV2.User = {
            id: MessageID.ascending(),
            sessionID: ctx.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: "build",
            model,
          }
          yield* session.updateMessage(msg)
          yield* session.updatePart({
            id: PartID.ascending(),
            messageID: msg.id,
            sessionID: ctx.sessionID,
            type: "text",
            text: `The plan at ${plan} has been approved, you can now edit files. Execute the plan`,
            synthetic: true,
          } satisfies MessageV2.TextPart)

          return {
            title: "Switching to build agent",
            output: "User approved switching to build agent. Wait for further instructions.",
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const PlanEnterTool = Tool.define(
  "plan_enter",
  Effect.gen(function* () {
    const session = yield* Session.Service
    const provider = yield* Provider.Service
    const fs = yield* AppFileSystem.Service

    return {
      description: ENTER_DESCRIPTION,
      parameters: z.object({
        walkthrough: z.string().describe("A comprehensive markdown walkthrough detailing changes, testing, and validation."),
      }),
      execute: (params: { walkthrough: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "plan_enter",
            patterns: ["*"],
            always: ["*"],
            metadata: params,
          })

          const info = yield* session.get(ctx.sessionID)
          const planFile = Session.plan(info)
          const planDir = path.dirname(planFile)
          const walkthroughFile = path.join(planDir, "walkthrough.md")
          
          yield* fs.ensureDir(planDir)
          yield* fs.writeFileString(walkthroughFile, params.walkthrough)

          const model = getLastModel(ctx.sessionID) ?? (yield* provider.defaultModel())

          const msg: MessageV2.User = {
            id: MessageID.ascending(),
            sessionID: ctx.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: "plan",
            model,
          }
          yield* session.updateMessage(msg)
          yield* session.updatePart({
            id: PartID.ascending(),
            messageID: msg.id,
            sessionID: ctx.sessionID,
            type: "text",
            text: `The build tasks are complete and a walkthrough has been generated at ${path.relative(Instance.worktree, walkthroughFile)}. Returning to plan mode.`,
            synthetic: true,
          } satisfies MessageV2.TextPart)

          return {
            title: "Returning to plan mode",
            output: "Successfully generated walkthrough and returned to plan mode.",
            metadata: { walkthroughFile: path.relative(Instance.worktree, walkthroughFile) },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
