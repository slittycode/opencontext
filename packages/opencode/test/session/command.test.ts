import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Instance } from "../../src/project/instance"
import { PermissionNext } from "../../src/permission/next"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { tmpdir } from "../fixture/fixture"

describe("session.command", () => {
  test("returns UnknownError when command id is missing", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        try {
          await SessionPrompt.command({
            sessionID: session.id,
            command: "does-not-exist",
            arguments: "",
          })
          throw new Error("expected command lookup to fail")
        } catch (error) {
          expect(error).toMatchObject({
            name: "UnknownError",
          })
          const message =
            typeof error === "object" && error !== null && "data" in error
              ? String((error as any).data?.message ?? "")
              : ""
          expect(message).toContain('Command not found: "does-not-exist".')
        }
      },
    })
  })

  test("applies bash permissions to command template shell interpolation", async () => {
    const previousTrust = process.env.OPENCODE_TRUST_PROJECT
    process.env.OPENCODE_TRUST_PROJECT = "1"

    try {
      await using tmp = await tmpdir({
        git: true,
        init: async (dir) => {
          const commandsDir = path.join(dir, ".opencode", "commands")
          await fs.mkdir(commandsDir, { recursive: true })
          await Bun.write(
            path.join(commandsDir, "blocked.md"),
            `---
description: command template shell
---
Result: !\`touch should-not-exist.txt\``,
          )
        },
      })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({
            permission: PermissionNext.fromConfig({ bash: "deny" }),
          })

          await expect(
            SessionPrompt.command({
              sessionID: session.id,
              command: "blocked",
              arguments: "",
            }),
          ).rejects.toBeInstanceOf(PermissionNext.DeniedError)

          const created = await Bun.file(path.join(tmp.path, "should-not-exist.txt")).exists()
          expect(created).toBe(false)
        },
      })
    } finally {
      if (previousTrust === undefined) delete process.env.OPENCODE_TRUST_PROJECT
      else process.env.OPENCODE_TRUST_PROJECT = previousTrust
    }
  })
})
