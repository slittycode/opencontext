import { expect, test } from "bun:test"
import { SystemPrompt } from "../../src/session/system"

const model = (id: string) =>
  ({
    providerID: "openai",
    api: { id },
  }) as any

test("routes gpt models to codex header prompt", () => {
  const prompt = SystemPrompt.provider(model("gpt-4.1"))[0]
  expect(prompt).toContain("You are OpenContext")
  expect(prompt).not.toContain("THE PROBLEM CAN NOT BE SOLVED WITHOUT EXTENSIVE INTERNET RESEARCH")
})

test("routes o-series models to codex header prompt", () => {
  const prompt = SystemPrompt.provider(model("o3"))[0]
  expect(prompt).toContain("You are OpenContext")
  expect(prompt).not.toContain("THE PROBLEM CAN NOT BE SOLVED WITHOUT EXTENSIVE INTERNET RESEARCH")
})
