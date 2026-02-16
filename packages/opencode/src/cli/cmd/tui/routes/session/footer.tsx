import { createMemo, For, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useDirectory } from "../../context/directory"
import { useConnected } from "../../component/dialog-model"
import { createStore } from "solid-js/store"
import { useRoute } from "../../context/route"
import { useLocal } from "../../context/local"
import { usePromptRef } from "../../context/prompt"
import { HANDOFF_SEEDS, recommendHandoffs } from "./handoff"

export function Footer() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()
  const promptRef = usePromptRef()
  const mcp = createMemo(() => Object.values(sync.data.mcp).filter((x) => x.status === "connected").length)
  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  const lsp = createMemo(() => Object.keys(sync.data.lsp))
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()
  const sessionMessages = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.message[route.data.sessionID] ?? []
  })
  const lastAssistant = createMemo(() => sessionMessages().findLast((item) => item.role === "assistant"))
  const lastAssistantText = createMemo(() => {
    const last = lastAssistant()
    if (!last) return ""
    const parts = sync.data.part[last.id] ?? []
    return parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .toLowerCase()
      .slice(0, 3000)
  })
  const visiblePrimary = createMemo(
    () =>
      new Set(sync.data.agent.filter((agent) => agent.mode !== "subagent" && !agent.hidden).map((agent) => agent.name)),
  )
  const handoffSuggestions = createMemo(() => {
    if (!connected()) return []
    if (route.data.type !== "session") return []
    if (sessionMessages().at(-1)?.role !== "assistant") return []

    const active = local.agent.current()
    const profile = local.agent.profile(active.name)
    if (!profile?.handoffs?.length) return []

    const text = lastAssistantText()
    if (!text) return []
    return recommendHandoffs({
      activeAgent: active.name,
      handoffs: profile.handoffs,
      visiblePrimary: visiblePrimary(),
      lastAssistantText: text,
      max: 2,
    })
  })

  function applyHandoff(target: string) {
    local.agent.set(target)
    const seed = HANDOFF_SEEDS[target]
    if (!seed) return
    promptRef.current?.set({
      input: seed,
      parts: [],
    })
    promptRef.current?.focus()
  }

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
    // Track all timeouts to ensure proper cleanup
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function tick() {
      if (connected()) return
      if (!store.welcome) {
        setStore("welcome", true)
        timeouts.push(setTimeout(() => tick(), 5000))
        return
      }

      if (store.welcome) {
        setStore("welcome", false)
        timeouts.push(setTimeout(() => tick(), 10_000))
        return
      }
    }
    timeouts.push(setTimeout(() => tick(), 10_000))

    onCleanup(() => {
      timeouts.forEach(clearTimeout)
    })
  })

  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
      <text fg={theme.textMuted}>{directory()}</text>
      <box gap={2} flexDirection="row" flexShrink={0}>
        <Switch>
          <Match when={store.welcome}>
            <text fg={theme.text}>
              Get started <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
          </Match>
          <Match when={connected()}>
            <Show when={permissions().length > 0}>
              <text fg={theme.warning}>
                <span style={{ fg: theme.warning }}>△</span> {permissions().length} Permission
                {permissions().length > 1 ? "s" : ""}
              </text>
            </Show>
            <text fg={theme.text}>
              <span style={{ fg: lsp().length > 0 ? theme.success : theme.textMuted }}>•</span> {lsp().length} LSP
            </text>
            <Show when={mcp()}>
              <text fg={theme.text}>
                <Switch>
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  <Match when={true}>
                    <span style={{ fg: theme.success }}>⊙ </span>
                  </Match>
                </Switch>
                {mcp()} MCP
              </text>
            </Show>
            <Show when={handoffSuggestions().length > 0}>
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>handoff</text>
                <For each={handoffSuggestions()}>
                  {(target) => (
                    <text fg={theme.text} onMouseUp={() => applyHandoff(target)}>
                      [{target}]
                    </text>
                  )}
                </For>
              </box>
            </Show>
            <text fg={theme.textMuted}>/status</text>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
