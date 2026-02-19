import { test, expect, beforeEach, afterEach } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { createNewSession } from "../../src/agent/companion/session-selection"
import { checkAndSuggestTitle, applyTitle } from "../../src/agent/companion/titling-flow"
import { listSessions, readIndex } from "../../src/agent/companion/index"
import path from "path"
import os from "os"
import fs from "fs/promises"

// Use a temporary directory for tests
const testDataDir = path.join(os.tmpdir(), "opencontext-test-companion-cli", Date.now().toString())

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

test("CLI lifecycle: untitled session → suggestion accepted (simulated)", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create a new companion session (simulates CLI session start)
      const sessionID = await createNewSession()
      
      // Simulate that user had a conversation (messages would be added here in real usage)
      // For this test, we verify the titling flow works even without messages
      
      // Simulate session exit: check if untitled and get suggestion
      const { wasUntitled, suggestion } = await checkAndSuggestTitle(sessionID)
      
      expect(wasUntitled).toBe(true)
      expect(suggestion).toBeDefined() // Will be date-based fallback since no messages
      
      // User accepts suggestion (simulates CLI confirm prompt)
      const finalTitle = await applyTitle(sessionID, suggestion!)
      
      expect(finalTitle).toBeDefined()
      
      // Verify index updated
      const index = await readIndex()
      expect(index[sessionID].title).toBe(finalTitle)
      
      // Verify Session.title updated
      const session = await Session.get(sessionID)
      expect(session?.title).toBe(finalTitle)
    },
  })
})

test("CLI lifecycle: untitled session → custom title entered", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create session
      const sessionID = await createNewSession()
      
      // Get suggestion
      const { wasUntitled, suggestion } = await checkAndSuggestTitle(sessionID)
      expect(wasUntitled).toBe(true)
      expect(suggestion).toBeDefined()
      
      // User rejects suggestion and provides custom title
      const customTitle = "My Custom Session Title"
      const finalTitle = await applyTitle(sessionID, customTitle)
      
      expect(finalTitle).toBe("my-custom-session-title")
      
      // Verify both index and Session.title updated
      const index = await readIndex()
      expect(index[sessionID].title).toBe("my-custom-session-title")
      
      const session = await Session.get(sessionID)
      expect(session?.title).toBe("my-custom-session-title")
    },
  })
})

test("CLI lifecycle: cancel at confirm → session remains untitled", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create session
      const sessionID = await createNewSession()
      
      // Get suggestion
      const { wasUntitled, suggestion } = await checkAndSuggestTitle(sessionID)
      expect(wasUntitled).toBe(true)
      expect(suggestion).toBeDefined()
      
      // User cancels at confirm prompt (simulated by NOT calling applyTitle)
      // Session should remain untitled
      
      // Verify session is still untitled in index
      const index = await readIndex()
      expect(index[sessionID].title).toBeNull()
      
      // Verify Session.title is still default
      const session = await Session.get(sessionID)
      expect(session?.title).toMatch(/^(New session - |Session )\d/)
    },
  })
})

test("CLI lifecycle: cancel at custom title prompt → session remains untitled", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create session
      const sessionID = await createNewSession()
      
      // Get suggestion
      const { wasUntitled, suggestion } = await checkAndSuggestTitle(sessionID)
      expect(wasUntitled).toBe(true)
      
      // User rejects suggestion but then cancels custom title input
      // (simulated by NOT calling applyTitle after rejection)
      
      // Verify session remains untitled
      const index = await readIndex()
      expect(index[sessionID].title).toBeNull()
      
      const session = await Session.get(sessionID)
      expect(session?.title).toMatch(/^(New session - |Session )\d/)
    },
  })
})

test("CLI lifecycle: already titled session skips prompt", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create session and immediately title it
      const sessionID = await createNewSession()
      
      // Title the session
      await applyTitle(sessionID, "Already Titled Session")
      
      // Simulate session exit: check if untitled
      const { wasUntitled, suggestion } = await checkAndSuggestTitle(sessionID)
      
      // Should indicate session is already titled
      expect(wasUntitled).toBe(false)
      expect(suggestion).toBeNull()
      
      // Verify title unchanged
      const index = await readIndex()
      expect(index[sessionID].title).toBe("already-titled-session")
      
      const session = await Session.get(sessionID)
      expect(session?.title).toBe("already-titled-session")
    },
  })
})

test("CLI lifecycle: metadata consistency after title apply", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create session
      const sessionID = await createNewSession()
      
      // Apply title
      const finalTitle = await applyTitle(sessionID, "Consistency Test Title")
      
      // Verify both companion index and Session.title are synchronized
      const index = await readIndex()
      const indexTitle = index[sessionID].title
      
      const session = await Session.get(sessionID)
      const sessionTitle = session?.title
      
      expect(indexTitle).toBe("consistency-test-title")
      expect(sessionTitle).toBe("consistency-test-title")
      expect(indexTitle).toBe(sessionTitle)
      expect(finalTitle).toBe("consistency-test-title")
    },
  })
})

test("CLI lifecycle: multiple sessions with different title states", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Create three sessions with different states
      const session1 = await createNewSession()
      await applyTitle(session1, "Titled Session One")
      
      const session2 = await createNewSession()
      // Leave session2 untitled
      
      const session3 = await createNewSession()
      await applyTitle(session3, "Titled Session Three")
      
      // List all sessions
      const sessions = await listSessions()
      expect(sessions.length).toBe(3)
      
      // Verify title states
      const s1 = sessions.find(([id]) => id === session1)
      const s2 = sessions.find(([id]) => id === session2)
      const s3 = sessions.find(([id]) => id === session3)
      
      expect(s1?.[1].title).toBe("titled-session-one")
      expect(s2?.[1].title).toBeNull()
      expect(s3?.[1].title).toBe("titled-session-three")
      
      // Verify Session.title consistency
      const sess1 = await Session.get(session1)
      const sess2 = await Session.get(session2)
      const sess3 = await Session.get(session3)
      
      expect(sess1?.title).toBe("titled-session-one")
      expect(sess2?.title).toMatch(/^(New session - |Session )\d/) // Default title
      expect(sess3?.title).toBe("titled-session-three")
    },
  })
})
