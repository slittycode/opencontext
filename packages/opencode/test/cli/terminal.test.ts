import { describe, expect, test } from "bun:test"
import { checkTuiSupport } from "../../src/cli/terminal"

describe("checkTuiSupport", () => {
  test("accepts interactive terminal with non-dumb TERM", () => {
    const result = checkTuiSupport({
      stdinTTY: true,
      stdoutTTY: true,
      term: "xterm-256color",
    })
    expect(result.ok).toBe(true)
  })

  test("rejects when stdin is not TTY", () => {
    const result = checkTuiSupport({
      stdinTTY: false,
      stdoutTTY: true,
      term: "xterm-256color",
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("stdin/stdout TTY")
  })

  test('rejects TERM="dumb"', () => {
    const result = checkTuiSupport({
      stdinTTY: true,
      stdoutTTY: true,
      term: "dumb",
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('TERM must not be "dumb"')
  })
})
