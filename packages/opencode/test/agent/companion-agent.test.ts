import { test, expect } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Agent } from "../../src/agent/agent"

test("companion agent appears in agent list", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const agents = await Agent.list()
      const names = agents.map((a) => a.name)
      expect(names).toContain("companion")
    },
  })
})

test("companion agent has correct properties", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const companion = await Agent.get("companion")
      expect(companion).toBeDefined()
      expect(companion?.name).toBe("companion")
      expect(companion?.description).toBe("Persistent agent with session memory. Remembers conversations.")
      expect(companion?.mode).toBe("primary")
      expect(companion?.native).toBe(true)
      expect(companion?.color).toBe("#14b8a6")
    },
  })
})

test("companion agent prompt file loads without errors", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const companion = await Agent.get("companion")
      expect(companion).toBeDefined()
      expect(companion?.prompt).toBeDefined()
      if (companion?.prompt) {
        expect(typeof companion.prompt).toBe("string")
        expect(companion.prompt.length).toBeGreaterThan(0)
      }
    },
  })
})
