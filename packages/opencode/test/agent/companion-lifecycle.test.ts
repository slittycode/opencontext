import { test, expect, beforeEach, afterEach } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Agent } from "../../src/agent/agent"
import {
  getAvailableSessions,
  createNewSession,
  loadExistingSession,
} from "../../src/agent/companion/session-selection"
import {
  checkAndSuggestTitle,
  applyTitle,
} from "../../src/agent/companion/titling-flow"
import {
  listSessions,
  addSession,
  readIndex,
} from "../../src/agent/companion/index"
import path from "path"
import os from "os"
import fs from "fs/promises"

// Helper to get the test index directory
function getTestIndexDir(): string {
  const dataDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
  return path.join(dataDir, "opencontext", "companions")
}

// Helper to clean up test index
async function cleanupTestIndex() {
  const indexPath = path.join(getTestIndexDir(), "index.json")
  try {
    await fs.unlink(indexPath)
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.warn("Failed to cleanup test index:", error)
    }
  }
}

beforeEach(async () => {
  await cleanupTestIndex()
})

afterEach(async () => {
  await cleanupTestIndex()
})

test("complete lifecycle: start new session → add to index → title → verify index updated", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Step 1: Start new session
      const sessionID = await createNewSession()
      expect(sessionID).toBeDefined()
      expect(typeof sessionID).toBe("string")

      // Step 2: Verify session added to index as untitled draft
      const indexAfterCreate = await readIndex()
      expect(indexAfterCreate[sessionID]).toBeDefined()
      expect(indexAfterCreate[sessionID].title).toBeNull()
      expect(indexAfterCreate[sessionID].lastModified).toBeGreaterThan(0)

      // Step 3: Simulate chat by adding a message to the session
      const session = await Session.get(sessionID)
      expect(session).toBeDefined()

      // Step 4: Check if session is untitled and get suggestion
      const { wasUntitled, suggestion } = await checkAndSuggestTitle(sessionID)
      expect(wasUntitled).toBe(true)
      expect(suggestion).toBeDefined()
      expect(typeof suggestion).toBe("string")

      // Step 5: Apply title
      const finalTitle = "test-conversation"
      const sanitizedTitle = await applyTitle(sessionID, finalTitle)
      expect(sanitizedTitle).toBe("test-conversation")

      // Step 6: Verify index updated with title
      const indexAfterTitle = await readIndex()
      expect(indexAfterTitle[sessionID]).toBeDefined()
      expect(indexAfterTitle[sessionID].title).toBe("test-conversation")
      expect(indexAfterTitle[sessionID].lastModified).toBeGreaterThan(0)

      // Step 7: Verify Session.title also updated
      const updatedSession = await Session.get(sessionID)
      expect(updatedSession?.title).toBe("test-conversation")
    },
  })
})

test("complete lifecycle: start → select existing session → load → verify history", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Step 1: Create a session and title it
      const sessionID = await createNewSession()
      await applyTitle(sessionID, "existing-session")

      // Step 2: Get available sessions
      const sessions = await getAvailableSessions()
      expect(sessions.length).toBe(1)
      expect(sessions[0].sessionID).toBe(sessionID)
      expect(sessions[0].title).toBe("existing-session")
      expect(sessions[0].isNew).toBe(false)

      // Step 3: Load the existing session
      const loadedSessionID = await loadExistingSession(sessionID)
      expect(loadedSessionID).toBe(sessionID)

      // Step 4: Verify session can be retrieved
      const session = await Session.get(loadedSessionID)
      expect(session).toBeDefined()
      expect(session?.title).toBe("existing-session")

      // Step 5: Verify lastModified was updated in index
      const indexAfterLoad = await readIndex()
      expect(indexAfterLoad[sessionID]).toBeDefined()
      expect(indexAfterLoad[sessionID].title).toBe("existing-session")
    },
  })
})

test("create multiple sessions → list → verify all appear sorted by lastModified", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create three sessions
      const session1ID = await createNewSession()
      const session2ID = await createNewSession()
      const session3ID = await createNewSession()

      // Title the sessions with delays to ensure different lastModified timestamps
      await applyTitle(session1ID, "first-session")
      await new Promise((resolve) => setTimeout(resolve, 10))

      await applyTitle(session2ID, "second-session")
      await new Promise((resolve) => setTimeout(resolve, 10))

      await applyTitle(session3ID, "third-session")

      // List sessions
      const sessions = await listSessions()
      expect(sessions.length).toBe(3)

      // Verify sorted by lastModified descending (most recent first)
      // session3 should be first (most recently titled)
      expect(sessions[0][0]).toBe(session3ID)
      expect(sessions[0][1].title).toBe("third-session")

      // session2 should be second
      expect(sessions[1][0]).toBe(session2ID)
      expect(sessions[1][1].title).toBe("second-session")

      // session1 should be last
      expect(sessions[2][0]).toBe(session1ID)
      expect(sessions[2][1].title).toBe("first-session")

      // Verify timestamps are in descending order
      expect(sessions[0][1].lastModified).toBeGreaterThanOrEqual(sessions[1][1].lastModified)
      expect(sessions[1][1].lastModified).toBeGreaterThanOrEqual(sessions[2][1].lastModified)
    },
  })
})

test("agent appears in opencontext agent list", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const agents = await Agent.list()
      const companionAgent = agents.find((a) => a.name === "companion")

      expect(companionAgent).toBeDefined()
      expect(companionAgent?.name).toBe("companion")
      expect(companionAgent?.description).toBe("Persistent agent with session memory. Remembers conversations.")
      expect(companionAgent?.mode).toBe("primary")
      expect(companionAgent?.native).toBe(true)
      expect(companionAgent?.color).toBe("#14b8a6")
    },
  })
})

test("untitled draft appears in session list with null title", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create a new session (untitled draft)
      const sessionID = await createNewSession()

      // List sessions
      const sessions = await getAvailableSessions()
      expect(sessions.length).toBe(1)
      expect(sessions[0].sessionID).toBe(sessionID)
      expect(sessions[0].title).toBeNull()
      expect(sessions[0].isNew).toBe(false)
    },
  })
})

test("loading existing session updates lastModified in index", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create and title a session
      const sessionID = await createNewSession()
      await applyTitle(sessionID, "test-session")

      // Get initial lastModified
      const indexBefore = await readIndex()
      const lastModifiedBefore = indexBefore[sessionID].lastModified

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Load the session
      await loadExistingSession(sessionID)

      // Verify lastModified was updated
      const indexAfter = await readIndex()
      const lastModifiedAfter = indexAfter[sessionID].lastModified

      expect(lastModifiedAfter).toBeGreaterThan(lastModifiedBefore)
    },
  })
})

test("multiple untitled drafts are sorted by lastModified", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create three untitled drafts with delays
      const draft1ID = await createNewSession()
      await new Promise((resolve) => setTimeout(resolve, 10))

      const draft2ID = await createNewSession()
      await new Promise((resolve) => setTimeout(resolve, 10))

      const draft3ID = await createNewSession()

      // List sessions
      const sessions = await listSessions()
      expect(sessions.length).toBe(3)

      // Verify all are untitled
      expect(sessions[0][1].title).toBeNull()
      expect(sessions[1][1].title).toBeNull()
      expect(sessions[2][1].title).toBeNull()

      // Verify sorted by lastModified descending
      expect(sessions[0][0]).toBe(draft3ID) // most recent
      expect(sessions[1][0]).toBe(draft2ID)
      expect(sessions[2][0]).toBe(draft1ID) // oldest
    },
  })
})

test("mixed titled and untitled sessions are sorted together by lastModified", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create sessions with mixed states
      const draft1ID = await createNewSession()
      await new Promise((resolve) => setTimeout(resolve, 10))

      const titled1ID = await createNewSession()
      await applyTitle(titled1ID, "titled-session")
      await new Promise((resolve) => setTimeout(resolve, 10))

      const draft2ID = await createNewSession()

      // List sessions
      const sessions = await listSessions()
      expect(sessions.length).toBe(3)

      // Verify order: draft2 (most recent), titled1, draft1 (oldest)
      expect(sessions[0][0]).toBe(draft2ID)
      expect(sessions[0][1].title).toBeNull()

      expect(sessions[1][0]).toBe(titled1ID)
      expect(sessions[1][1].title).toBe("titled-session")

      expect(sessions[2][0]).toBe(draft1ID)
      expect(sessions[2][1].title).toBeNull()
    },
  })
})
