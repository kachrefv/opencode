import { Context, Effect, Layer, Option } from "effect"

import { Instance } from "../project/instance"
import { Indexer } from "../indexer/indexer"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_GPT from "./prompt/gpt.txt"
import PROMPT_KIMI from "./prompt/kimi.txt"

import PROMPT_CODEX from "./prompt/codex.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import type { Provider } from "@/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"

export function provider(model: Provider.Model) {
  if (model.api.id.includes("gpt-4") || model.api.id.includes("o1") || model.api.id.includes("o3"))
    return [PROMPT_BEAST]
  if (model.api.id.includes("gpt")) {
    if (model.api.id.includes("codex")) {
      return [PROMPT_CODEX]
    }
    return [PROMPT_GPT]
  }
  if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
  if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
  if (model.api.id.toLowerCase().includes("kimi")) return [PROMPT_KIMI]
  return [PROMPT_DEFAULT]
}

export interface Interface {
  readonly environment: (model: Provider.Model) => string[]
  readonly volatile: () => Effect.Effect<string[]>
  readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SystemPrompt") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Skill.Service

    return Service.of({
      environment(model) {
        return [
          [
            `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
            `# Indexer & Notes`,
            `Use the indexer tools (codebase_map, indexer_note_add, indexer_note_search, indexer_note_list) to navigate the codebase and store persistent insights.`,
            `When creating or significantly modifying core files, use indexer_note_add to leave an atomic note explaining structural decisions.`,
          ].join("\n"),
        ]
      },

      volatile: Effect.fn("SystemPrompt.volatile")(function* () {
        const project = Instance.project
        const indexer = yield* Effect.serviceOption(Indexer.Service)

        let codebaseMapString = ""
        if (Option.isSome(indexer)) {
          const map = yield* Effect.catchDefect(indexer.value.getMap(".", 2), () => Effect.succeed([]))
          
          if (map.length > 0) {
            const formatTree = (nodes: any[], indent = ""): string => {
              return nodes
                .map((node) => {
                  const line = `${indent}- ${node.path.split("/").pop()}`
                  const children = node.children ? "\n" + formatTree(node.children, indent + "  ") : ""
                  return line + children
                })
                .join("\n")
            }
            codebaseMapString = `\n<codebase_map>\n${formatTree(map)}\n</codebase_map>\n`
          }
        }

        return [
          [
            `Here is some useful information about the environment you are running in:`,
            `<env>`,
            `  Working directory: ${Instance.directory}`,
            `  Workspace root folder: ${Instance.worktree}`,
            `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
            `  Platform: ${process.platform}`,
            `  Today's date: ${new Date().toDateString()}`,
            `</env>`,
            codebaseMapString
          ].filter(Boolean).join("\n"),
        ]
      }),

      skills: Effect.fn("SystemPrompt.skills")(function* (agent: Agent.Info) {
        if (Permission.disabled(["skill"], agent.permission).has("skill")) return

        const list = yield* skill.available(agent)
        const sortedList = [...list].sort((a, b) => a.name.localeCompare(b.name))

        return [
          "Skills provide specialized instructions and workflows for specific tasks.",
          "Use the skill tool to load a skill when a task matches its description.",
          // the agents seem to ingest the information about skills a bit better if we present a more verbose
          // version of them here and a less verbose version in tool description, rather than vice versa.
          Skill.fmt(sortedList, { verbose: true }),
        ].join("\n")
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Skill.defaultLayer))

export * as SystemPrompt from "./system"
