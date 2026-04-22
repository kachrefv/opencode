import { Component, createResource } from "solid-js"
import { useSDK } from "@/context/sdk"
import { usePrompt } from "@/context/prompt"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { useLanguage } from "@/context/language"
import { useDialog } from "@opencode-ai/ui/context/dialog"

export const DialogSelectSkill: Component = () => {
  const sdk = useSDK()
  const prompt = usePrompt()
  const language = useLanguage()
  const dialog = useDialog()

  const [skills] = createResource(async () => {
    const result = await sdk.client.app.skills()
    return result.data ?? []
  })

  return (
    <Dialog
      title={language.t("dialog.skill.title")}
      description={language.t("dialog.skill.description")}
    >
      <List
        search={{ placeholder: language.t("common.search.placeholder"), autofocus: true }}
        emptyMessage={language.t("dialog.skill.empty")}
        key={(x) => x?.name ?? ""}
        items={skills() ?? []}
        filterKeys={["name", "description"]}
        sortBy={(a, b) => a.name.localeCompare(b.name)}
        onSelect={(skill) => {
          if (!skill) return
          dialog.close()
          const text = `/${skill.name} `
          prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
        }}
      >
        {(skill) => (
          <div class="w-full flex items-center justify-between gap-x-3 p-1">
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="truncate font-medium">{skill.name}</span>
              <span class="text-12-regular text-text-weaker truncate">
                {skill.description}
              </span>
            </div>
          </div>
        )}
      </List>
    </Dialog>
  )
}
