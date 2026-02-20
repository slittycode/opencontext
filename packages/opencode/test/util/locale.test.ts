import { describe, expect, test } from "bun:test"
import { Locale } from "../../src/util/locale"

describe("Locale.titlecase", () => {
  test("uses explicit display override for codeexpert", () => {
    expect(Locale.titlecase("codeexpert")).toBe("Code Expert")
  })

  test("converts separators into word boundaries", () => {
    expect(Locale.titlecase("deep_research-agent")).toBe("Deep Research Agent")
  })
})
