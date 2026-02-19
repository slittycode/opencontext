import { cmd } from "./cmd"
import { Instance } from "../../project/instance"
import { Session } from "../../session"
import { getAvailableSessions, createNewSession, loadExistingSession } from "../../agent/companion/session-selection"
import { checkAndSuggestTitle, applyTitle } from "../../agent/companion/titling-flow"
import { select, text, confirm, isCancel } from "@clack/prompts"
import { Log } from "../../util/log"
import { tui } from "./tui/app"
import { Rpc } from "@/util/rpc"
import { type rpc } from "./tui/worker"
import { iife } from "@/util/iife"
import { checkTuiSupport, restoreTerminalState } from "@/cli/terminal"
import { UI } from "@/cli/ui"
import type { Event } from "@opencode-ai/sdk/v2"
import type { EventSource } from "./tui/context/sdk"

const log = Log.create({ service: "cli.companion" })

type RpcClient = ReturnType<typeof Rpc.client<typeof rpc>>

function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined
    const result = await client.call("fetch", {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    })
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    })
  }
  return fn as typeof fetch
}

function createEventSource(client: RpcClient): EventSource {
  return {
    on: (handler) => client.on<Event>("event", handler),
  }
}

export const CompanionCommand = cmd({
  command: "companion",
  describe: "Start a conversation with the companion agent",
  builder: (yargs) => yargs,
  handler: async () => {
    const terminal = checkTuiSupport({
      stdinTTY: !!process.stdin.isTTY,
      stdoutTTY: !!process.stdout.isTTY,
      term: process.env.TERM,
    })
    if (!terminal.ok) {
      UI.error(terminal.reason ?? "Companion agent requires an interactive terminal.")
      process.exitCode = 1
      return
    }

    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const sessionID = await selectCompanionSession()
        if (!sessionID) {
          console.log("Cancelled.")
          return
        }

        await launchCompanionTUI(sessionID)
      },
    })
  },
})

async function selectCompanionSession(): Promise<string | null> {
  // Get available companion sessions
  const sessions = await getAvailableSessions()

  let sessionID: string

  if (sessions.length === 0) {
    // No existing sessions - create new one
    console.log("\nNo previous companion sessions found.")
    console.log("Starting a new conversation...\n")
    sessionID = await createNewSession()
    return sessionID
  }

  // Build session choices
  const choices = sessions.map((session) => {
    const date = new Date(session.lastModified).toLocaleString()
    if (session.title) {
      return {
        value: session.sessionID,
        label: session.title,
        hint: date,
      }
    } else {
      return {
        value: session.sessionID,
        label: `Untitled draft`,
        hint: date,
      }
    }
  })

  // Add "Start new session" option at the top
  choices.unshift({
    value: "__new__",
    label: "Start a new session",
    hint: "Begin a fresh conversation",
  })

  const choice = await select({
    message: "Choose a session to continue or start fresh:",
    options: choices,
  })

  if (choice === "__new__") {
    sessionID = await createNewSession()
    console.log("\nStarting new companion session...\n")
  } else if (typeof choice === "string") {
    sessionID = await loadExistingSession(choice)
    const session = await Session.get(sessionID)
    console.log(`\nResuming session: ${session.title}\n`)
  } else {
    // User cancelled
    return null
  }

  return sessionID
}

declare global {
  var OPENCODE_WORKER_PATH: string
}

async function launchCompanionTUI(sessionID: string) {
  const localWorker = new URL("./tui/worker.ts", import.meta.url)
  const distWorker = new URL("./tui/worker.js", import.meta.url)
  const workerPath = await iife(async () => {
    if (typeof OPENCODE_WORKER_PATH !== "undefined") return OPENCODE_WORKER_PATH
    if (await Bun.file(distWorker).exists()) return distWorker
    return localWorker
  })

  const worker = new Worker(workerPath, {
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  })

  let terminalRestored = false
  let exiting = false
  const restoreOnce = () => {
    if (terminalRestored) return
    terminalRestored = true
    restoreTerminalState()
  }
  const exitWithCleanup = (code: number) => {
    if (exiting) return
    exiting = true
    restoreOnce()
    process.exitCode = code
    process.exit(code)
  }

  worker.onerror = (e) => {
    Log.Default.error(e)
  }

  const client = Rpc.client<typeof rpc>(worker)

  process.on("uncaughtException", (e) => {
    restoreOnce()
    Log.Default.error(e)
    if (e instanceof Error && e.message.includes("EIO: i/o error, read")) {
      UI.error("Terminal I/O disconnected unexpectedly.")
      UI.println(UI.Style.TEXT_DIM + "Run `reset` if your shell prompt looks corrupted.")
    }
    exitWithCleanup(1)
  })
  process.on("unhandledRejection", (e) => {
    restoreOnce()
    Log.Default.error(e)
    exitWithCleanup(1)
  })
  process.on("exit", restoreOnce)
  process.once("SIGINT", () => exitWithCleanup(130))
  process.once("SIGTERM", () => exitWithCleanup(143))
  process.on("SIGUSR2", async () => {
    await client.call("reload", undefined)
  })

  // Use direct RPC communication (no HTTP server needed for companion)
  const url = "http://opencode.internal"
  const customFetch = createWorkerFetch(client)
  const events = createEventSource(client)

  const tuiPromise = tui({
    url,
    fetch: customFetch,
    events,
    args: {
      sessionID,
      agent: "companion",
      continue: false, // We're explicitly loading a session, not continuing the last one
      fork: false,
    },
    onExit: async () => {
      await client.call("shutdown", undefined)
    },
  })

  await tuiPromise.finally(async () => {
    restoreOnce()
    
    // Execute titling flow on exit if session is untitled
    try {
      await handleSessionTitling(sessionID)
    } catch (error) {
      // Log error but don't crash exit flow
      log.error("titling flow failed, continuing graceful shutdown", { sessionID, error })
    }
  })
}

/**
 * Handle session titling on exit.
 * Prompts user to title the session if it's currently untitled.
 * If user cancels, session remains as untitled draft.
 * 
 * @param sessionID - The session ID to check and potentially title
 */
async function handleSessionTitling(sessionID: string): Promise<void> {
  try {
    const { wasUntitled, suggestion } = await checkAndSuggestTitle(sessionID)
    
    if (!wasUntitled) {
      // Session is already titled, nothing to do
      return
    }
    
    if (!suggestion) {
      // Shouldn't happen, but handle gracefully
      log.warn("session was untitled but no suggestion generated", { sessionID })
      return
    }
    
    console.log("\n")
    
    // Ask user if they want to accept the suggested title
    const acceptSuggestion = await confirm({
      message: `Title this session "${suggestion}"?`,
      initialValue: true,
    })
    
    // Handle cancellation at confirm prompt
    if (isCancel(acceptSuggestion)) {
      console.log("\nSession saved as untitled draft. You can title it later.\n")
      log.info("user cancelled title confirmation, session remains untitled", { sessionID })
      return
    }
    
    let finalTitle: string
    
    if (acceptSuggestion) {
      finalTitle = suggestion
    } else {
      // User wants to provide custom title
      const customTitle = await text({
        message: "Enter a title for this session:",
        placeholder: suggestion,
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return "Title cannot be empty"
          }
        },
      })
      
      // Handle cancellation at custom title prompt
      if (isCancel(customTitle)) {
        console.log("\nSession saved as untitled draft. You can title it later.\n")
        log.info("user cancelled custom title input, session remains untitled", { sessionID })
        return
      }
      
      finalTitle = customTitle
    }
    
    // Apply the title
    const sanitizedTitle = await applyTitle(sessionID, finalTitle)
    console.log(`\n✓ Session saved as: ${sanitizedTitle}\n`)
  } catch (error) {
    // Log but don't throw - we don't want to crash the exit flow
    log.error("error in handleSessionTitling", { sessionID, error })
  }
}
