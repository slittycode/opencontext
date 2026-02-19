import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import path from "path"
import fs from "fs/promises"
import os from "os"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { addSession, removeSession } from "../../src/agent/companion/index"
import {
  getAvailableSessions,
  createNewSession,
  loadExistingSession,
} from "../../src/agent/companion/session-selection"

// Use a temporary directory for tests
const testDataDir = path.join(os.tmpdir(), "opencontext-test-companion-selection", Date.now().toString())
const testProjectDir = path.join(os.tmpdir(), "opencontext-test-project", Date.now().toString())

// Override the index directory for tests
const originalEnv = process.env.XDG_DATA_HOME

async function tmpdir() {
  const dir = path.join(os.tmpdir(), "opencontext-test", Date.now().toString(), Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  return {
    path: dir,
    async [Symbol.asyncDispose]() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
}

beforeEach(async () => {
  process.env.XDG_DATA_HOME = testDataDir
  await fs.mkdir(testProjectDir, { recursive: true })
})

afterEach(async () => {
  // Clean up test directories
  await fs.rm(testDataDir, { recursive: true, force: true })
  await fs.rm(testProjectDir, { recursive: true, force: true })
  process.env.XDG_DATA_HOME = originalEnv
})

describe("companion.session-selection getAvailableSessions", () => {
  test("returns empty array when index is empty", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessions = await getAvailableSessions()
        expect(sessions).toEqual([])
      },
    })
  })

  test("returns sessions from index with metadata", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create a real session
        const session = await Session.create({ title: "Test Session" })
        
        // Add to companion index
        await addSession(session.id, "test-session")
        
        // Get available sessions
        const sessions = await getAvailableSessions()
        
        expect(sessions).toHaveLength(1)
        expect(sessions[0].sessionID).toBe(session.id)
        expect(sessions[0].title).toBe("test-session")
        expect(sessions[0].isNew).toBe(false)
        expect(sessions[0].lastModified).toBeGreaterThan(0)
      },
    })
  })

  test("returns multiple sessions sorted by lastModified", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create multiple sessions
        const session1 = await Session.create({ title: "First" })
        await addSession(session1.id, "first")
        
        await new Promise(resolve => setTimeout(resolve, 10))
        
        const session2 = await Session.create({ title: "Second" })
        await addSession(session2.id, "second")
        
        await new Promise(resolve => setTimeout(resolve, 10))
        
        const session3 = await Session.create({ title: "Third" })
        await addSession(session3.id, "third")
        
        // Get available sessions
        const sessions = await getAvailableSessions()
        
        expect(sessions).toHaveLength(3)
        // Most recent first
        expect(sessions[0].sessionID).toBe(session3.id)
        expect(sessions[1].sessionID).toBe(session2.id)
        expect(sessions[2].sessionID).toBe(session1.id)
      },
    })
  })

  test("includes untitled draft sessions (title is null)", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create session and add as draft (null title)
        const session = await Session.create({})
        await addSession(session.id, null)
        
        const sessions = await getAvailableSessions()
        
        expect(sessions).toHaveLength(1)
        expect(sessions[0].sessionID).toBe(session.id)
        expect(sessions[0].title).toBe(null)
      },
    })
  })

  test("skips sessions in index that don't exist in Session.get", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Add a non-existent session to index
        await addSession("non-existent-session-id", "ghost-session")
        
        // Create a real session
        const session = await Session.create({})
        await addSession(session.id, "real-session")
        
        const sessions = await getAvailableSessions()
        
        // Should only return the real session
        expect(sessions).toHaveLength(1)
        expect(sessions[0].sessionID).toBe(session.id)
      },
    })
  })
})

describe("companion.session-selection createNewSession", () => {
  test("creates new session via Session.create", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = await createNewSession()
        
        expect(sessionID).toBeDefined()
        expect(typeof sessionID).toBe("string")
        
        // Verify session exists
        const session = await Session.get(sessionID)
        expect(session).toBeDefined()
        expect(session?.id).toBe(sessionID)
      },
    })
  })

  test("adds new session to index as untitled draft", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = await createNewSession()
        
        // Check that it's in the index with null title
        const sessions = await getAvailableSessions()
        
        expect(sessions).toHaveLength(1)
        expect(sessions[0].sessionID).toBe(sessionID)
        expect(sessions[0].title).toBe(null)
      },
    })
  })

  test("creates multiple independent sessions", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID1 = await createNewSession()
        const sessionID2 = await createNewSession()
        
        expect(sessionID1).not.toBe(sessionID2)
        
        const sessions = await getAvailableSessions()
        expect(sessions).toHaveLength(2)
      },
    })
  })
})

describe("companion.session-selection loadExistingSession", () => {
  test("loads existing session by ID", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create a session
        const session = await Session.create({ title: "Test Session" })
        await addSession(session.id, "test")
        
        // Load it
        const loadedID = await loadExistingSession(session.id)
        
        expect(loadedID).toBe(session.id)
      },
    })
  })

  test("throws error when session doesn't exist", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Use a valid session ID format that doesn't exist
        const fakeSessionID = "ses_01JBQR8X9Y0Z1A2B3C4D5E6F7G"
        await expect(loadExistingSession(fakeSessionID)).rejects.toThrow()
      },
    })
  })

  test("loads session with full history", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create a session
        const session = await Session.create({ title: "Test Session" })
        await addSession(session.id, "test")
        
        // Load it
        const loadedID = await loadExistingSession(session.id)
        
        // Verify we can get the session info
        const sessionInfo = await Session.get(loadedID)
        expect(sessionInfo).toBeDefined()
        expect(sessionInfo?.title).toBe("Test Session")
      },
    })
  })
})
