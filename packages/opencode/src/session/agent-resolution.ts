import { Agent } from "@/agent/agent"
import { NamedError } from "@opencode-ai/util/error"
import { Log } from "@/util/log"

const log = Log.create({ service: "session.agent-resolution" })
const seenWarnings = new Set<string>()

export type ResolveContext = "prompt" | "shell" | "loop" | "command" | "subtask" | "doom_loop"

type ResolveMode = "error" | "default" | "none"

export type ResolveSessionAgentInput = {
  requested?: string
  context: ResolveContext
  mode: ResolveMode
  sessionID?: string
}

export type ResolveSessionAgentResult = {
  requested: string
  canonical: string
  agent?: Agent.Info
  fallbackUsed: boolean
  message?: string
}

function warnOnce(key: string, message: string, extra?: Record<string, unknown>) {
  if (seenWarnings.has(key)) return
  seenWarnings.add(key)
  log.warn(message, extra)
}

async function availableAgentNames() {
  return Agent.list().then((agents) => agents.filter((a) => !a.hidden).map((a) => a.name))
}

function buildUnknownAgentMessage(input: {
  requested: string
  canonical: string
  available: string[]
  fallback?: string
}) {
  const hints: string[] = []
  if (input.canonical !== input.requested) {
    hints.push(`Did you mean "${input.canonical}"?`)
  }
  if (input.fallback) {
    hints.push(`Falling back to "${input.fallback}".`)
  }
  if (input.available.length) {
    hints.push(`Available agents: ${input.available.join(", ")}`)
  }

  const suffix = hints.length ? ` ${hints.join(" ")}` : ""
  return `Agent not found: "${input.requested}".${suffix}`
}

export async function resolveSessionAgent(input: ResolveSessionAgentInput): Promise<ResolveSessionAgentResult> {
  const requested = input.requested ?? (await Agent.defaultAgent())
  const resolved = await Agent.resolve(requested)

  if (resolved.deprecated) {
    warnOnce(
      ["deprecated", input.context, input.sessionID ?? "global", resolved.deprecated.from, resolved.deprecated.to].join(
        ":",
      ),
      resolved.deprecated.message,
      {
        context: input.context,
        sessionID: input.sessionID,
        from: resolved.deprecated.from,
        to: resolved.deprecated.to,
      },
    )
  }

  if (resolved.agent) {
    return {
      requested,
      canonical: resolved.canonical,
      agent: resolved.agent,
      fallbackUsed: false,
    }
  }

  const available = await availableAgentNames()

  if (input.mode === "default") {
    const fallbackName = await Agent.defaultAgent().catch(() => undefined)
    if (fallbackName) {
      const fallback = await Agent.resolve(fallbackName)
      if (fallback.agent) {
        const message = buildUnknownAgentMessage({
          requested,
          canonical: resolved.canonical,
          available,
          fallback: fallback.agent.name,
        })
        warnOnce(["fallback", input.context, input.sessionID ?? "global", requested].join(":"), message, {
          context: input.context,
          sessionID: input.sessionID,
          requested,
          fallback: fallback.agent.name,
        })

        return {
          requested,
          canonical: fallback.agent.name,
          agent: fallback.agent,
          fallbackUsed: true,
          message,
        }
      }
    }
  }

  const message = buildUnknownAgentMessage({
    requested,
    canonical: resolved.canonical,
    available,
  })

  if (input.mode === "none") {
    warnOnce(["missing", input.context, input.sessionID ?? "global", requested].join(":"), message, {
      context: input.context,
      sessionID: input.sessionID,
      requested,
    })
    return {
      requested,
      canonical: resolved.canonical,
      fallbackUsed: false,
      message,
    }
  }

  throw new NamedError.Unknown({ message })
}
