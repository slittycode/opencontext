import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import type { AgentProfileMetadata } from "@/agent/agent-profiles"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()

  const profile = (name: string): AgentProfileMetadata | undefined => local.agent.profile(name)
  const category = (name: string) => {
    if (name === "coding" || name === "plan") return "Core"
    return "Specialist"
  }

  const currentProfile = createMemo(() => profile(local.agent.current().name))

  const options = createMemo(() => {
    const currentCapabilities = currentProfile()?.capabilities ?? []

    return local.agent.list().map((item) => {
      const meta = profile(item.name)
      const mode = local.agent.mode.current(item.name)
      const capabilities = meta?.capabilities ?? []
      const gained = capabilities.filter((x) => !currentCapabilities.includes(x))
      const dropped = currentCapabilities.filter((x) => !capabilities.includes(x))

      const capabilityDelta =
        gained.length || dropped.length
          ? `caps: ${gained.length ? "+" + gained.join(",+") : ""}${gained.length && dropped.length ? " " : ""}${dropped.length ? "-" + dropped.join(",-") : ""}`
          : "caps: no change"

      const modeLabel = mode?.label ?? meta?.defaultMode
      const bestFor = meta?.bestFor?.slice(0, 2).join(", ")
      const description = [
        item.description ?? "No description provided.",
        modeLabel ? `mode: ${modeLabel}` : undefined,
        bestFor ? `best for: ${bestFor}` : undefined,
        meta?.risk ? `risk: ${meta.risk}` : undefined,
        capabilityDelta,
      ]
        .filter(Boolean)
        .join(" · ")

      return {
        value: item.name,
        title: item.name,
        description,
        category: category(item.name),
        footer: meta?.capabilities?.slice(0, 3).join(", "),
        gutter: <text style={{ fg: local.agent.color(item.name) }}>●</text>,
      }
    })
  })

  return (
    <DialogSelect
      title="Select agent"
      current={local.agent.current().name}
      options={options()}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
