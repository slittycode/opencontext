import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { deleteContextEntry, readContextEntry, saveContextEntry } from "../../src/context-store/service"

describe("context store path safety", () => {
  test("normalizes category paths to stay within .context", async () => {
    await using tmp = await tmpdir()

    const entry = await saveContextEntry({
      title: "Release Notes",
      content: "trusted content",
      category: "../../Sensitive Data",
      directory: tmp.path,
    })

    expect(entry.path).toBe("sensitive-data/release-notes.md")
    const inside = path.join(tmp.path, ".context", "sensitive-data", "release-notes.md")
    const outside = path.join(tmp.path, "sensitive-data", "release-notes.md")
    expect(await Bun.file(inside).exists()).toBe(true)
    expect(await Bun.file(outside).exists()).toBe(false)
  })

  test("read rejects traversal outside .context", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "outside.md"), "outside")
      },
    })

    await expect(
      readContextEntry({
        entryPath: "../outside.md",
        directory: tmp.path,
      }),
    ).rejects.toThrow("escapes .context directory")
  })

  test("delete rejects traversal outside .context", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "outside.md"), "outside")
      },
    })

    await expect(
      deleteContextEntry({
        entryPath: "../outside.md",
        directory: tmp.path,
      }),
    ).rejects.toThrow("escapes .context directory")
  })
})
