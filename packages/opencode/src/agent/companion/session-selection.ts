import { Session } from "../../session"
import { listSessions, addSession } from "./index"
import { Log } from "../../util/log"

const log = Log.create({ service: "companion.session-selection" })

export interface SessionChoice {
  sessionID: string
  title: string | null
  lastModified: number
  isNew: boolean
}

/**
 * Get available companion sessions for selection.
 * Returns sessions from the index with full Session.Info metadata.
 */
export async function getAvailableSessions(): Promise<SessionChoice[]> {
  const indexSessions = await listSessions()
  const choices: SessionChoice[] = []

  for (const [sessionID, metadata] of indexSessions) {
    try {
      // Verify session still exists in the main session system
      const sessionInfo = await Session.get(sessionID)
      if (sessionInfo) {
        choices.push({
          sessionID,
          title: metadata.title,
          lastModified: metadata.lastModified,
          isNew: false,
        })
      } else {
        log.warn("session in index but not found in Session.get", { sessionID })
      }
    } catch (error) {
      log.error("failed to get session info", { sessionID, error })
    }
  }

  return choices
}

/**
 * Create a new companion session.
 * Creates the session via Session.create() and adds it to the companion index.
 */
export async function createNewSession(): Promise<string> {
  const session = await Session.create({})
  
  // Add to companion index as untitled draft
  await addSession(session.id, null)
  
  log.info("created new companion session", { sessionID: session.id })
  return session.id
}

/**
 * Load an existing companion session.
 * Returns the session ID for use with SessionPrompt.loop.
 * Updates lastModified in the index to keep sort order accurate.
 */
export async function loadExistingSession(sessionID: string): Promise<string> {
  // Verify session exists
  const session = await Session.get(sessionID)
  if (!session) {
    throw new Error(`Session ${sessionID} not found`)
  }
  
  // Update lastModified in index to reflect this activity
  // This ensures the session sorts to the top next time
  const indexSessions = await listSessions()
  const existingEntry = indexSessions.find(([id]) => id === sessionID)
  const existingTitle = existingEntry?.[1].title ?? null
  
  await addSession(sessionID, existingTitle)
  
  log.info("loading existing companion session", { sessionID, title: session.title })
  return sessionID
}
