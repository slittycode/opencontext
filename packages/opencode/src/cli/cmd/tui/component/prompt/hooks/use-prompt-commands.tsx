import { DialogSkill } from "../../dialog-skill"
import { Editor } from "@tui/util/editor"
import { Clipboard } from "../../../util/clipboard"
import { DialogStash } from "../../dialog-stash"

export function usePromptCommands(args: any) {
  const {
    command,
    input,
    autocomplete,
    store,
    setStore,
    props: promptProps,
    sdk,
    status,
    dialog,
    pasteImage,
    renderer,
    restoreExtmarksFromParts,
    stash,
    submit,
  } = args
  const getInput = () => (typeof input === "function" ? input() : input)
  const getAutocomplete = () => (typeof autocomplete === "function" ? autocomplete() : autocomplete)

  command.register(() => {
    return [
      {
        title: "Clear prompt",
        value: "prompt.clear",
        category: "Prompt",
        hidden: true,
        onSelect: (dialog: any) => {
          const currentInput = getInput()
          if (!currentInput) return
          currentInput.extmarks.clear()
          currentInput.clear()
          dialog.clear()
        },
      },
      {
        title: "Submit prompt",
        value: "prompt.submit",
        keybind: "input_submit",
        category: "Prompt",
        hidden: true,
        onSelect: (dialog: any) => {
          const currentInput = getInput()
          if (!currentInput?.focused) return
          submit()
          dialog.clear()
        },
      },
      {
        title: "Paste",
        value: "prompt.paste",
        keybind: "input_paste",
        category: "Prompt",
        hidden: true,
        onSelect: async () => {
          const content = await Clipboard.read()
          if (content?.mime.startsWith("image/")) {
            await pasteImage({
              filename: "clipboard",
              mime: content.mime,
              content: content.data,
            })
          }
        },
      },
      {
        title: "Interrupt session",
        value: "session.interrupt",
        keybind: "session_interrupt",
        category: "Session",
        hidden: true,
        enabled: status().type !== "idle",
        onSelect: (dialog: any) => {
          if (getAutocomplete()?.visible) return
          const currentInput = getInput()
          if (!currentInput?.focused) return
          // TODO: this should be its own command
          if (store.mode === "shell") {
            setStore("mode", "normal")
            return
          }
          if (!promptProps.sessionID) return

          setStore("interrupt", store.interrupt + 1)

          setTimeout(() => {
            setStore("interrupt", 0)
          }, 5000)

          if (store.interrupt >= 2) {
            sdk.client.session.abort({
              sessionID: promptProps.sessionID,
            })
            setStore("interrupt", 0)
          }
          dialog.clear()
        },
      },
      {
        title: "Open editor",
        category: "Session",
        keybind: "editor_open",
        value: "prompt.editor",
        slash: {
          name: "editor",
        },
        onSelect: async (dialog: any) => {
          dialog.clear()

          // replace summarized text parts with the actual text
          const text = store.prompt.parts
            .filter((p: any) => p.type === "text")
            .reduce((acc: any, p: any) => {
              if (!p.source) return acc
              return acc.replace(p.source.text.value, p.text)
            }, store.prompt.input)

          const nonTextParts = store.prompt.parts.filter((p: any) => p.type !== "text")

          const value = text
          const content = await Editor.open({ value, renderer })
          if (!content) return

          const currentInput = getInput()
          if (!currentInput) return
          currentInput.setText(content)

          // Update positions for nonTextParts based on their location in new content
          // Filter out parts whose virtual text was deleted
          // this handles a case where the user edits the text in the editor
          // such that the virtual text moves around or is deleted
          const updatedNonTextParts = nonTextParts
            .map((part: any) => {
              let virtualText = ""
              if (part.type === "file" && part.source?.text) {
                virtualText = part.source.text.value
              } else if (part.type === "agent" && part.source) {
                virtualText = part.source.value
              }

              if (!virtualText) return part

              const newStart = content.indexOf(virtualText)
              // if the virtual text is deleted, remove the part
              if (newStart === -1) return null

              const newEnd = newStart + virtualText.length

              if (part.type === "file" && part.source?.text) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    text: {
                      ...part.source.text,
                      start: newStart,
                      end: newEnd,
                    },
                  },
                }
              }

              if (part.type === "agent" && part.source) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    start: newStart,
                    end: newEnd,
                  },
                }
              }

              return part
            })
            .filter((part: any) => part !== null)

          setStore("prompt", {
            input: content,
            // keep only the non-text parts because the text parts were
            // already expanded inline
            parts: updatedNonTextParts,
          })
          restoreExtmarksFromParts(updatedNonTextParts)
          currentInput.cursorOffset = Bun.stringWidth(content)
        },
      },
      {
        title: "Skills",
        value: "prompt.skills",
        category: "Prompt",
        slash: {
          name: "skills",
        },
        onSelect: () => {
          dialog.replace(() => (
            <DialogSkill
              onSelect={(skill: any) => {
                const currentInput = getInput()
                if (!currentInput) return
                currentInput.setText(`/${skill} `)
                setStore("prompt", {
                  input: `/${skill} `,
                  parts: [],
                })
                currentInput.gotoBufferEnd()
              }}
            />
          ))
        },
      },
    ]
  })

  command.register(() => [
    {
      title: "Stash prompt",
      value: "prompt.stash",
      category: "Prompt",
      enabled: !!store.prompt.input,
      onSelect: (dialog: any) => {
        if (!store.prompt.input) return
        stash.push({
          input: store.prompt.input,
          parts: store.prompt.parts,
        })
        const currentInput = getInput()
        if (!currentInput) return
        currentInput.extmarks.clear()
        currentInput.clear()
        setStore("prompt", { input: "", parts: [] })
        setStore("extmarkToPartIndex", new Map())
        dialog.clear()
      },
    },
    {
      title: "Stash pop",
      value: "prompt.stash.pop",
      category: "Prompt",
      enabled: stash.list().length > 0,
      onSelect: (dialog: any) => {
        const entry = stash.pop()
        if (entry) {
          const currentInput = getInput()
          if (!currentInput) return
          currentInput.setText(entry.input)
          setStore("prompt", { input: entry.input, parts: entry.parts })
          restoreExtmarksFromParts(entry.parts)
          currentInput.gotoBufferEnd()
        }
        dialog.clear()
      },
    },
    {
      title: "Stash list",
      value: "prompt.stash.list",
      category: "Prompt",
      enabled: stash.list().length > 0,
      onSelect: (dialog: any) => {
        dialog.replace(() => (
          <DialogStash
            onSelect={(entry: any) => {
              const currentInput = getInput()
              if (!currentInput) return
              currentInput.setText(entry.input)
              setStore("prompt", { input: entry.input, parts: entry.parts })
              restoreExtmarksFromParts(entry.parts)
              currentInput.gotoBufferEnd()
            }}
          />
        ))
      },
    },
  ])
}
