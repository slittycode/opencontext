import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { resolveSessionAgent } from "../../src/session/agent-resolution"
import { SessionPrompt } from "../../src/session/prompt"
import { tmpdir } from "../fixture/fixture"

describe("session agent resolution", () => {
  test("session.prompt canonicalizes legacy agent IDs", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        const message = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "research",
          noReply: true,
          parts: [{ type: "text", text: "summarize this" }],
        })

        if (message.info.role !== "user") throw new Error("expected user message")
        expect(message.info.agent).toBe("researcher")
      },
    })
  })

  test("session.shell canonicalizes legacy agent IDs before persistence", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        await SessionPrompt.shell({
          sessionID: session.id,
          agent: "socratic",
          command: "printf hi",
        })

        const messages = await MessageV2.filterCompacted(MessageV2.stream(session.id))
        const user = messages.findLast((m) => m.info.role === "user")?.info
        expect(user?.agent).toBe("teacher")
      },
    })
  })

  test("session.prompt returns NamedError.Unknown for invalid agent input", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        await expect(
          SessionPrompt.prompt({
            sessionID: session.id,
            agent: "not-a-real-agent",
            noReply: true,
            parts: [{ type: "text", text: "hello" }],
          }),
        ).rejects.toMatchObject({
          name: "UnknownError",
        })
      },
    })
  })

  test("session.shell returns NamedError.Unknown for invalid agent input", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        await expect(
          SessionPrompt.shell({
            sessionID: session.id,
            agent: "not-a-real-agent",
            command: "echo should-not-run",
          }),
        ).rejects.toMatchObject({
          name: "UnknownError",
        })
      },
    })
  })

  test("runtime loop-mode resolution falls back to default agent for missing historical IDs", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const result = await resolveSessionAgent({
          requested: "retired-agent-from-history",
          context: "loop",
          mode: "default",
          sessionID: "session_test",
        })

        expect(result.agent?.name).toBe("coding")
        expect(result.fallbackUsed).toBe(true)
        expect(result.message).toContain("Falling back")
      },
    })
  })

  test("missing-agent subtask resolution does not throw and returns warning payload", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const result = await resolveSessionAgent({
          requested: "subtask-agent-that-does-not-exist",
          context: "subtask",
          mode: "none",
          sessionID: "session_test",
        })

        expect(result.agent).toBeUndefined()
        expect(result.message).toContain("Agent not found")
        expect(result.fallbackUsed).toBe(false)
      },
    })
  })
})
