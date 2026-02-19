import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import path from "path"
import fs from "fs/promises"
import os from "os"
import {
  readIndex,
  writeIndex,
  ensureIndexDir,
  addSession,
  removeSession,
  listSessions,
  sanitizeTitle,
  type CompanionIndex,
} from "../../src/agent/companion/index"

// Use a temporary directory for tests
const testDataDir = path.join(os.tmpdir(), "opencontext-test-companion", Date.now().toString())

// Override the index directory for tests
const originalEnv = process.env.XDG_DATA_HOME

beforeEach(() => {
  process.env.XDG_DATA_HOME = testDataDir
})

afterEach(async () => {
  // Clean up test directory
  await fs.rm(testDataDir, { recursive: true, force: true })
  process.env.XDG_DATA_HOME = originalEnv
})

describe("companion.index readIndex", () => {
  test("returns empty object when file doesn't exist", async () => {
    const index = await readIndex()
    expect(index).toEqual({})
  })

  test("returns parsed index when file exists", async () => {
    const testIndex: CompanionIndex = {
      "session-1": { title: "test-session", lastModified: 1000 },
    }
    await writeIndex(testIndex)

    const index = await readIndex()
    expect(index).toEqual(testIndex)
  })

  test("returns empty object when file contains invalid JSON", async () => {
    await ensureIndexDir()
    const indexPath = path.join(testDataDir, "opencontext", "companions", "index.json")
    await fs.writeFile(indexPath, "invalid json{", "utf-8")

    const index = await readIndex()
    expect(index).toEqual({})
  })
})

describe("companion.index writeIndex", () => {
  test("creates directory if it doesn't exist", async () => {
    const testIndex: CompanionIndex = {
      "session-1": { title: "test", lastModified: 1000 },
    }
    await writeIndex(testIndex)

    const indexPath = path.join(testDataDir, "opencontext", "companions", "index.json")
    const exists = await fs.access(indexPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  test("writes index atomically using temp file", async () => {
    const testIndex: CompanionIndex = {
      "session-1": { title: "test", lastModified: 1000 },
    }
    await writeIndex(testIndex)

    const index = await readIndex()
    expect(index).toEqual(testIndex)
  })

  test("overwrites existing index", async () => {
    const index1: CompanionIndex = {
      "session-1": { title: "first", lastModified: 1000 },
    }
    await writeIndex(index1)

    const index2: CompanionIndex = {
      "session-2": { title: "second", lastModified: 2000 },
    }
    await writeIndex(index2)

    const result = await readIndex()
    expect(result).toEqual(index2)
  })
})

describe("companion.index addSession", () => {
  test("adds new session to empty index", async () => {
    await addSession("session-1", "test-title")

    const index = await readIndex()
    expect(index["session-1"]).toBeDefined()
    expect(index["session-1"].title).toBe("test-title")
    expect(index["session-1"].lastModified).toBeGreaterThan(0)
  })

  test("adds session with null title (draft)", async () => {
    await addSession("session-1", null)

    const index = await readIndex()
    expect(index["session-1"]).toBeDefined()
    expect(index["session-1"].title).toBe(null)
  })

  test("updates existing session", async () => {
    await addSession("session-1", "original-title")
    const originalIndex = await readIndex()
    const originalTime = originalIndex["session-1"].lastModified

    // Wait a bit to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 10))

    await addSession("session-1", "updated-title")
    const updatedIndex = await readIndex()

    expect(updatedIndex["session-1"].title).toBe("updated-title")
    expect(updatedIndex["session-1"].lastModified).toBeGreaterThan(originalTime)
  })

  test("preserves other sessions when adding new one", async () => {
    await addSession("session-1", "first")
    await addSession("session-2", "second")

    const index = await readIndex()
    expect(Object.keys(index)).toHaveLength(2)
    expect(index["session-1"].title).toBe("first")
    expect(index["session-2"].title).toBe("second")
  })
})

describe("companion.index removeSession", () => {
  test("removes existing session", async () => {
    await addSession("session-1", "test")
    await removeSession("session-1")

    const index = await readIndex()
    expect(index["session-1"]).toBeUndefined()
  })

  test("does nothing when session doesn't exist", async () => {
    await addSession("session-1", "test")
    await removeSession("session-2")

    const index = await readIndex()
    expect(index["session-1"]).toBeDefined()
  })

  test("preserves other sessions when removing one", async () => {
    await addSession("session-1", "first")
    await addSession("session-2", "second")
    await removeSession("session-1")

    const index = await readIndex()
    expect(Object.keys(index)).toHaveLength(1)
    expect(index["session-2"].title).toBe("second")
  })
})

describe("companion.index listSessions", () => {
  test("returns empty array for empty index", async () => {
    const sessions = await listSessions()
    expect(sessions).toEqual([])
  })

  test("returns all sessions", async () => {
    await addSession("session-1", "first")
    await addSession("session-2", "second")

    const sessions = await listSessions()
    expect(sessions).toHaveLength(2)
  })

  test("sorts sessions by lastModified descending (most recent first)", async () => {
    await addSession("session-1", "first")
    await new Promise(resolve => setTimeout(resolve, 10))
    await addSession("session-2", "second")
    await new Promise(resolve => setTimeout(resolve, 10))
    await addSession("session-3", "third")

    const sessions = await listSessions()
    expect(sessions).toHaveLength(3)
    expect(sessions[0][0]).toBe("session-3") // most recent
    expect(sessions[1][0]).toBe("session-2")
    expect(sessions[2][0]).toBe("session-1") // oldest
  })

  test("includes both titled and untitled sessions", async () => {
    await addSession("session-1", "titled")
    await addSession("session-2", null)

    const sessions = await listSessions()
    expect(sessions).toHaveLength(2)
    
    const titled = sessions.find(([id]) => id === "session-1")
    const untitled = sessions.find(([id]) => id === "session-2")
    
    expect(titled?.[1].title).toBe("titled")
    expect(untitled?.[1].title).toBe(null)
  })
})

describe("companion.index sanitizeTitle", () => {
  test("converts to lowercase", () => {
    expect(sanitizeTitle("Hello World")).toBe("hello-world")
  })

  test("replaces spaces with hyphens", () => {
    expect(sanitizeTitle("hello world test")).toBe("hello-world-test")
  })

  test("removes special characters", () => {
    expect(sanitizeTitle("hello@world#test!")).toBe("helloworldtest")
  })

  test("collapses multiple hyphens", () => {
    expect(sanitizeTitle("hello---world")).toBe("hello-world")
  })

  test("trims hyphens from edges", () => {
    expect(sanitizeTitle("-hello-world-")).toBe("hello-world")
  })

  test("limits to 50 characters", () => {
    const longTitle = "a".repeat(100)
    expect(sanitizeTitle(longTitle)).toHaveLength(50)
  })

  test("returns 'session' for empty string", () => {
    expect(sanitizeTitle("")).toBe("session")
  })

  test("returns 'session' when only special characters", () => {
    expect(sanitizeTitle("@#$%^&*()")).toBe("session")
  })

  test("handles unicode characters", () => {
    expect(sanitizeTitle("hello 世界")).toBe("hello")
  })

  test("handles mixed case with numbers", () => {
    expect(sanitizeTitle("Test123 Session456")).toBe("test123-session456")
  })

  test("preserves existing hyphens", () => {
    expect(sanitizeTitle("hello-world")).toBe("hello-world")
  })
})
