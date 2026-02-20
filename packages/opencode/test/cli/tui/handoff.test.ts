import { expect, test } from "bun:test"
import { recommendHandoffs } from "../../../src/cli/cmd/tui/routes/session/handoff"

test("handoff recommendations include relevant targets from assistant context", () => {
  const suggestions = recommendHandoffs({
    activeAgent: "researcher",
    handoffs: ["teacher", "codeexpert", "ideator"],
    visiblePrimary: new Set(["teacher", "codeexpert", "ideator"]),
    lastAssistantText: "I can explain this architecture and provide implementation steps.",
  })

  expect(suggestions).toContain("teacher")
  expect(suggestions).toContain("codeexpert")
})

test("handoff recommendations suppress non-primary or hidden targets", () => {
  const suggestions = recommendHandoffs({
    activeAgent: "teacher",
    handoffs: ["researcher", "ideator", "career"],
    visiblePrimary: new Set(["researcher"]),
    lastAssistantText: "Let's brainstorm career options and compare job paths.",
  })

  expect(suggestions).toEqual(["researcher"])
})

test("handoff recommendations are unique and capped", () => {
  const suggestions = recommendHandoffs({
    activeAgent: "codeexpert",
    handoffs: ["researcher", "teacher", "ideator", "career", "researcher"],
    visiblePrimary: new Set(["researcher", "teacher", "ideator", "career"]),
    lastAssistantText:
      "Research sources first, then explain trade-offs, brainstorm alternatives, and map career implications.",
    max: 2,
  })

  expect(suggestions.length).toBe(2)
  expect(new Set(suggestions).size).toBe(2)
})
