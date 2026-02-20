import { batch } from "solid-js"
import { useRoute, useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useLocal } from "@tui/context/local"
import { useSDK } from "@tui/context/sdk"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useKeybind } from "@tui/context/keybind"
import { useDialog } from "../../../ui/dialog"
import { useToast } from "../../../ui/toast"
import { Clipboard } from "../../../util/clipboard"
import { DialogSessionRename } from "../../../component/dialog-session-rename"
import { DialogTimeline } from "../dialog-timeline"
import { DialogForkFromTimeline } from "../dialog-fork-from-timeline"
import { DialogExportOptions } from "../../../ui/dialog-export-options"
import { formatTranscript } from "../../../util/transcript"
import { Editor } from "../../../util/editor"
import path from "path"

export function useSessionCommands(props: {
  sidebarVisible: () => boolean
  setSidebar: (val: any) => void
  setSidebarOpen: (val: boolean) => void
  conceal: () => boolean
  setConceal: any
  showTimestamps: () => boolean
  setTimestamps: any
  showThinking: () => boolean
  setShowThinking: any
  showDetails: () => boolean
  setShowDetails: any
  showScrollbar: () => boolean
  setShowScrollbar: any
  showAssistantMetadata: () => boolean
  moveChild: (dir: number) => void
  scrollToMessage: (dir: "next" | "prev", dialog: any) => void
  toBottom: () => void
  session: () => any
  messages: () => any[]
  scroll: any
  prompt: any
  renderer: any
}) {
  const route = useRouteData("session") as any
  const { navigate } = useRoute()
  const sync = useSync()
  const local = useLocal()
  const sdk = useSDK()
  const command = useCommandDialog()
  const keybind = useKeybind()
  const toast = useToast()

  command.register(() => [
    {
      title: "Share session",
      value: "session.share",
      suggested: route.type === "session",
      keybind: "session_share",
      category: "Session",
      enabled: sync.data.config.share !== "disabled" && !props.session()?.share?.url,
      slash: {
        name: "share",
      },
      onSelect: async (dialog) => {
        await sdk.client.session
          .share({
            sessionID: route.sessionID,
          })
          .then((res: any) =>
            Clipboard.copy(res.data!.share!.url).catch(() =>
              toast.show({ message: "Failed to copy URL to clipboard", variant: "error" }),
            ),
          )
          .then(() => toast.show({ message: "Share URL copied to clipboard!", variant: "success" }))
          .catch(() => toast.show({ message: "Failed to share session", variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: "Rename session",
      value: "session.rename",
      keybind: "session_rename",
      category: "Session",
      slash: {
        name: "rename",
      },
      onSelect: (dialog) => {
        dialog.replace(() => <DialogSessionRename session={route.sessionID} />)
      },
    },
    {
      title: "Jump to message",
      value: "session.timeline",
      keybind: "session_timeline",
      category: "Session",
      slash: {
        name: "timeline",
      },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogTimeline
            onMove={(messageID: string) => {
              const child = props.scroll?.getChildren().find((child: any) => child.id === messageID)
              if (child) props.scroll.scrollBy(child.y - props.scroll.y - 1)
            }}
            sessionID={route.sessionID}
            setPrompt={(promptInfo: any) => props.prompt?.set(promptInfo)}
          />
        ))
      },
    },
    {
      title: "Fork from message",
      value: "session.fork",
      keybind: "session_fork",
      category: "Session",
      slash: {
        name: "fork",
      },
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogForkFromTimeline
            onMove={(messageID: string) => {
              const child = props.scroll?.getChildren().find((child: any) => child.id === messageID)
              if (child) props.scroll.scrollBy(child.y - props.scroll.y - 1)
            }}
            sessionID={route.sessionID}
          />
        ))
      },
    },
    {
      title: "Compact session",
      value: "session.compact",
      keybind: "session_compact",
      category: "Session",
      slash: {
        name: "compact",
        aliases: ["summarize"],
      },
      onSelect: (dialog) => {
        const selectedModel = local.model.current()
        if (!selectedModel) {
          toast.show({
            variant: "warning",
            message: "Connect a provider to summarize this session",
            duration: 3000,
          })
          return
        }
        sdk.client.session.summarize({
          sessionID: route.sessionID,
          modelID: selectedModel.modelID,
          providerID: selectedModel.providerID,
        })
        dialog.clear()
      },
    },
    {
      title: "Unshare session",
      value: "session.unshare",
      keybind: "session_unshare",
      category: "Session",
      enabled: !!props.session()?.share?.url,
      slash: {
        name: "unshare",
      },
      onSelect: async (dialog) => {
        await sdk.client.session
          .unshare({
            sessionID: route.sessionID,
          })
          .then(() => toast.show({ message: "Session unshared successfully", variant: "success" }))
          .catch(() => toast.show({ message: "Failed to unshare session", variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: "Undo previous message",
      value: "session.undo",
      keybind: "messages_undo",
      category: "Session",
      slash: {
        name: "undo",
      },
      onSelect: async (dialog) => {
        const status = sync.data.session_status?.[route.sessionID]
        if (status?.type !== "idle") await sdk.client.session.abort({ sessionID: route.sessionID }).catch(() => {})
        const revert = props.session()?.revert?.messageID
        const message = props.messages().findLast((x: any) => (!revert || x.id < revert) && x.role === "user")
        if (!message) return
        sdk.client.session
          .revert({
            sessionID: route.sessionID,
            messageID: message.id,
          })
          .then(() => {
            props.toBottom()
          })
        const parts = sync.data.part[message.id]
        props.prompt?.set(
          parts.reduce(
            (agg: any, part: any) => {
              if (part.type === "text") {
                if (!part.synthetic) agg.input += part.text
              }
              if (part.type === "file") agg.parts.push(part)
              return agg
            },
            { input: "", parts: [] },
          ),
        )
        dialog.clear()
      },
    },
    {
      title: "Redo",
      value: "session.redo",
      keybind: "messages_redo",
      category: "Session",
      enabled: !!props.session()?.revert?.messageID,
      slash: {
        name: "redo",
      },
      onSelect: (dialog) => {
        dialog.clear()
        const messageID = props.session()?.revert?.messageID
        if (!messageID) return
        const message = props.messages().find((x: any) => x.role === "user" && x.id > messageID)
        if (!message) {
          sdk.client.session.unrevert({
            sessionID: route.sessionID,
          })
          props.prompt?.set({ input: "", parts: [] })
          return
        }
        sdk.client.session.revert({
          sessionID: route.sessionID,
          messageID: message.id,
        })
      },
    },
    {
      title: props.sidebarVisible() ? "Hide sidebar" : "Show sidebar",
      value: "session.sidebar.toggle",
      keybind: "sidebar_toggle",
      category: "Session",
      onSelect: (dialog) => {
        batch(() => {
          const isVisible = props.sidebarVisible()
          props.setSidebar(() => (isVisible ? "hide" : "auto"))
          props.setSidebarOpen(!isVisible)
        })
        dialog.clear()
      },
    },
    {
      title: props.conceal() ? "Disable code concealment" : "Enable code concealment",
      value: "session.toggle.conceal",
      keybind: "messages_toggle_conceal" as any,
      category: "Session",
      onSelect: (dialog) => {
        props.setConceal((prev: any) => !prev)
        dialog.clear()
      },
    },
    {
      title: props.showTimestamps() ? "Hide timestamps" : "Show timestamps",
      value: "session.toggle.timestamps",
      category: "Session",
      slash: {
        name: "timestamps",
        aliases: ["toggle-timestamps"],
      },
      onSelect: (dialog) => {
        props.setTimestamps((prev: any) => (prev === "show" ? "hide" : "show"))
        dialog.clear()
      },
    },
    {
      title: props.showThinking() ? "Hide thinking" : "Show thinking",
      value: "session.toggle.thinking",
      keybind: "display_thinking",
      category: "Session",
      slash: {
        name: "thinking",
        aliases: ["toggle-thinking"],
      },
      onSelect: (dialog) => {
        props.setShowThinking((prev: any) => !prev)
        dialog.clear()
      },
    },
    {
      title: props.showDetails() ? "Hide tool details" : "Show tool details",
      value: "session.toggle.actions",
      keybind: "tool_details",
      category: "Session",
      onSelect: (dialog) => {
        props.setShowDetails((prev: any) => !prev)
        dialog.clear()
      },
    },
    {
      title: "Toggle session scrollbar",
      value: "session.toggle.scrollbar",
      keybind: "scrollbar_toggle",
      category: "Session",
      onSelect: (dialog) => {
        props.setShowScrollbar((prev: any) => !prev)
        dialog.clear()
      },
    },
    {
      title: "Page up",
      value: "session.page.up",
      keybind: "messages_page_up",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.scroll?.scrollBy(-props.scroll.height / 2)
        dialog.clear()
      },
    },
    {
      title: "Page down",
      value: "session.page.down",
      keybind: "messages_page_down",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.scroll?.scrollBy(props.scroll.height / 2)
        dialog.clear()
      },
    },
    {
      title: "Line up",
      value: "session.line.up",
      keybind: "messages_line_up",
      category: "Session",
      disabled: true,
      onSelect: (dialog) => {
        props.scroll?.scrollBy(-1)
        dialog.clear()
      },
    },
    {
      title: "Line down",
      value: "session.line.down",
      keybind: "messages_line_down",
      category: "Session",
      disabled: true,
      onSelect: (dialog) => {
        props.scroll?.scrollBy(1)
        dialog.clear()
      },
    },
    {
      title: "Half page up",
      value: "session.half.page.up",
      keybind: "messages_half_page_up",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.scroll?.scrollBy(-props.scroll.height / 4)
        dialog.clear()
      },
    },
    {
      title: "Half page down",
      value: "session.half.page.down",
      keybind: "messages_half_page_down",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.scroll?.scrollBy(props.scroll.height / 4)
        dialog.clear()
      },
    },
    {
      title: "First message",
      value: "session.first",
      keybind: "messages_first",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.scroll?.scrollTo(0)
        dialog.clear()
      },
    },
    {
      title: "Last message",
      value: "session.last",
      keybind: "messages_last",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.scroll?.scrollTo(props.scroll.scrollHeight)
        dialog.clear()
      },
    },
    {
      title: "Jump to last user message",
      value: "session.messages_last_user",
      keybind: "messages_last_user",
      category: "Session",
      hidden: true,
      onSelect: () => {
        const msgs = sync.data.message[route.sessionID]
        if (!msgs || !msgs.length) return
        for (let i = msgs.length - 1; i >= 0; i--) {
          const message = msgs[i]
          if (!message || message.role !== "user") continue
          const parts = sync.data.part[message.id]
          if (!parts || !Array.isArray(parts)) continue
          const hasValidTextPart = parts.some(
            (part: any) => part && part.type === "text" && !part.synthetic && !part.ignored,
          )
          if (hasValidTextPart) {
            const child = props.scroll?.getChildren().find((child: any) => child.id === message.id)
            if (child) props.scroll.scrollBy(child.y - props.scroll.y - 1)
            break
          }
        }
      },
    },
    {
      title: "Next message",
      value: "session.message.next",
      keybind: "messages_next",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => props.scrollToMessage("next", dialog),
    },
    {
      title: "Previous message",
      value: "session.message.previous",
      keybind: "messages_previous",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => props.scrollToMessage("prev", dialog),
    },
    {
      title: "Copy last assistant message",
      value: "messages.copy",
      keybind: "messages_copy",
      category: "Session",
      onSelect: (dialog) => {
        const revertID = props.session()?.revert?.messageID
        const lastAssistantMessage = props.messages().findLast(
          (msg: any) => msg.role === "assistant" && (!revertID || msg.id < revertID),
        )
        if (!lastAssistantMessage) {
          toast.show({ message: "No assistant messages found", variant: "error" })
          dialog.clear()
          return
        }
        const parts = sync.data.part[lastAssistantMessage.id] ?? []
        const textParts = parts.filter((part: any) => part.type === "text")
        if (textParts.length === 0) {
          toast.show({ message: "No text parts found in last assistant message", variant: "error" })
          dialog.clear()
          return
        }
        const text = textParts
          .map((part: any) => part.text)
          .join("\n")
          .trim()
        if (!text) {
          toast.show({
            message: "No text content found in last assistant message",
            variant: "error",
          })
          dialog.clear()
          return
        }
        Clipboard.copy(text)
          .then(() => toast.show({ message: "Message copied to clipboard!", variant: "success" }))
          .catch(() => toast.show({ message: "Failed to copy to clipboard", variant: "error" }))
        dialog.clear()
      },
    },
    {
      title: "Copy session transcript",
      value: "session.copy",
      category: "Session",
      slash: {
        name: "copy",
      },
      onSelect: async (dialog) => {
        try {
          const sessionData = props.session()
          if (!sessionData) return
          const sessionMessages = props.messages()
          const transcript = formatTranscript(
            sessionData,
            sessionMessages.map((msg: any) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
            {
              thinking: props.showThinking(),
              toolDetails: props.showDetails(),
              assistantMetadata: props.showAssistantMetadata(),
            },
          )
          await Clipboard.copy(transcript)
          toast.show({ message: "Session transcript copied to clipboard!", variant: "success" })
        } catch (error) {
          toast.show({ message: "Failed to copy session transcript", variant: "error" })
        }
        dialog.clear()
      },
    },
    {
      title: "Export session transcript",
      value: "session.export",
      keybind: "session_export",
      category: "Session",
      slash: {
        name: "export",
      },
      onSelect: async (dialog) => {
        try {
          const sessionData = props.session()
          if (!sessionData) return
          const sessionMessages = props.messages()
          const defaultFilename = `session-${sessionData.id.slice(0, 8)}.md`
          const options = await DialogExportOptions.show(
            dialog,
            defaultFilename,
            props.showThinking(),
            props.showDetails(),
            props.showAssistantMetadata(),
            false,
          )
          if (options === null) return
          const transcript = formatTranscript(
            sessionData,
            sessionMessages.map((msg: any) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
            {
              thinking: options.thinking,
              toolDetails: options.toolDetails,
              assistantMetadata: options.assistantMetadata,
            },
          )
          if (options.openWithoutSaving) {
            await Editor.open({ value: transcript, renderer: props.renderer })
          } else {
            const exportDir = process.cwd()
            const filename = options.filename.trim()
            const filepath = path.join(exportDir, filename)
            await Bun.write(filepath, transcript)
            const result = await Editor.open({ value: transcript, renderer: props.renderer })
            if (result !== undefined) {
              await Bun.write(filepath, result)
            }
            toast.show({ message: `Session exported to ${filename}`, variant: "success" })
          }
        } catch (error) {
          toast.show({ message: "Failed to export session", variant: "error" })
        }
        dialog.clear()
      },
    },
    {
      title: "Next child session",
      value: "session.child.next",
      keybind: "session_child_cycle",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.moveChild(1)
        dialog.clear()
      },
    },
    {
      title: "Previous child session",
      value: "session.child.previous",
      keybind: "session_child_cycle_reverse",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        props.moveChild(-1)
        dialog.clear()
      },
    },
    {
      title: "Go to parent session",
      value: "session.parent",
      keybind: "session_parent",
      category: "Session",
      hidden: true,
      onSelect: (dialog) => {
        const parentID = props.session()?.parentID
        if (parentID) {
          navigate({
            type: "session",
            sessionID: parentID,
          })
        }
        dialog.clear()
      },
    },
  ])
}
