import { expect, test } from "bun:test"
import { Agent } from "../../src/agent/agent"
import { PermissionNext } from "../../src/permission/next"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { resolveSessionAgent } from "../../src/session/agent-resolution"

type Scenario = {
  name: string
  checks: Array<{
    permission: string
    expected: "allow" | "deny" | "ask"
  }>
}

const SCENARIOS: Scenario[] = [
  {
    name: "researcher",
    checks: [
      { permission: "websearch", expected: "allow" },
      { permission: "edit", expected: "deny" },
      { permission: "bash", expected: "deny" },
    ],
  },
  {
    name: "teacher",
    checks: [
      { permission: "question", expected: "allow" },
      { permission: "read", expected: "allow" },
      { permission: "edit", expected: "deny" },
    ],
  },
  {
    name: "ideator",
    checks: [
      { permission: "websearch", expected: "allow" },
      { permission: "write", expected: "deny" },
      { permission: "edit", expected: "deny" },
    ],
  },
  {
    name: "career",
    checks: [
      { permission: "write", expected: "allow" },
      { permission: "bash", expected: "deny" },
      { permission: "edit", expected: "deny" },
    ],
  },
  {
    name: "codeexpert",
    checks: [
      { permission: "write", expected: "allow" },
      { permission: "edit", expected: "allow" },
      { permission: "bash", expected: "allow" },
    ],
  },
]

test("agent eval harness enforces profile + safety baseline threshold", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      let passed = 0
      let total = 0

      for (const scenario of SCENARIOS) {
        const agent = await Agent.get(scenario.name)
        expect(agent).toBeDefined()
        expect(agent?.mode).toBe("primary")

        const profile = agent?.options?.profile
        expect(profile).toBeDefined()
        expect(Array.isArray(profile?.modes)).toBe(true)
        expect(typeof profile?.defaultMode).toBe("string")
        expect(profile?.modes.some((mode: { id: string }) => mode.id === profile.defaultMode)).toBe(true)

        for (const check of scenario.checks) {
          total += 1
          const action = PermissionNext.evaluate(check.permission, "*", agent!.permission).action
          if (action === check.expected) passed += 1
        }
      }

      const passRate = total === 0 ? 0 : passed / total
      const MIN_PASS_RATE = 1
      expect(passRate).toBeGreaterThanOrEqual(MIN_PASS_RATE)

      // Fallback-safety gate: unknown historical agent IDs must not hard-fail runtime resolution.
      const fallback = await resolveSessionAgent({
        requested: "unknown-legacy-agent",
        context: "loop",
        mode: "default",
        sessionID: "session_eval",
      })
      expect(fallback.agent?.name).toBe("coding")
      expect(fallback.fallbackUsed).toBe(true)
    },
  })
})
