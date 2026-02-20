import { describe, expect, test } from "bun:test"
import { normalizeCliArgs } from "../../src/cli/args"

describe("normalizeCliArgs", () => {
  test("maps bare invocation to current directory command", () => {
    expect(normalizeCliArgs([])).toEqual(["."])
  })

  test("preserves explicit args", () => {
    expect(normalizeCliArgs(["run", "hello"])).toEqual(["run", "hello"])
  })
})
