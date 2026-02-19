import { listSessions, addSession, sanitizeTitle } from "./index"
import { generateDefaultTitle } from "./title-generator"
import { Session } from "../../session"
import { Log } from "../../util/log"

const log = Log.create({ service: "companion.titling-flow" })

export interface TitlingResult {
  sessionID: string
  title: string
  wasUntitled: boolean
}

/**
 * Check if a session is untitled (has title === null in the index).
 * 
 * @param sessionID - The session ID to check
 * @returns true if the session is untitled, false otherwise
 */
export async function isSessionUntitled(sessionID: string): Promise<boolean> {
  const sessions = await listSessions()
  const sessionEntry = sessions.find(([id]) => id === sessionID)
  
  if (!sessionEntry) {
    log.warn("session not found in index", { sessionID })
    return false
  }
  
  return sessionEntry[1].title === null
}

/**
 * Execute the titling flow for a session.
 * 
 * This function:
 * 1. Checks if the session is untitled
 * 2. If untitled, generates a default title suggestion
 * 3. Returns the suggestion for the caller to present to the user
 * 4. Accepts the user's final title choice
 * 5. Updates the index with the new title
 * 
 * Note: This function returns the suggested title but does NOT prompt the user.
 * The caller is responsible for presenting the suggestion and getting user input.
 * Call `applyTitle()` after getting the user's choice.
 * 
 * @param sessionID - The session ID to title
 * @returns The suggested title, or null if the session is already titled
 */
export async function getSuggestedTitle(sessionID: string): Promise<string | null> {
  const untitled = await isSessionUntitled(sessionID)
  
  if (!untitled) {
    log.info("session is already titled, skipping titling flow", { sessionID })
    return null
  }
  
  // Generate default title suggestion
  const suggestion = await generateDefaultTitle(sessionID)
  log.info("generated title suggestion", { sessionID, suggestion })
  
  return suggestion
}

/**
 * Apply a title to a session.
 * 
 * This function:
 * 1. Sanitizes the user-provided title
 * 2. Updates the companion index with the new title
 * 3. Updates the Session.title to keep metadata synchronized
 * 4. Returns the final sanitized title
 * 
 * @param sessionID - The session ID to title
 * @param userTitle - The title provided by the user (will be sanitized)
 * @returns The final sanitized title that was applied
 */
export async function applyTitle(sessionID: string, userTitle: string): Promise<string> {
  // Sanitize the user-provided title
  const sanitized = sanitizeTitle(userTitle)
  
  // Update the companion index with the new title
  await addSession(sessionID, sanitized)
  
  // Update the Session.title to keep metadata synchronized
  // This ensures resume path and session metadata are consistent
  await Session.update(sessionID, (draft) => {
    draft.title = sanitized
  })
  
  log.info("applied title to session", { sessionID, title: sanitized })
  return sanitized
}

/**
 * Complete titling flow: check if untitled, get suggestion, and return result.
 * 
 * This is a convenience function that combines checking and suggestion generation.
 * The caller still needs to prompt the user and call `applyTitle()`.
 * 
 * @param sessionID - The session ID to check and generate suggestion for
 * @returns Object with wasUntitled flag and suggested title (null if already titled)
 */
export async function checkAndSuggestTitle(sessionID: string): Promise<{
  wasUntitled: boolean
  suggestion: string | null
}> {
  const untitled = await isSessionUntitled(sessionID)
  
  if (!untitled) {
    return {
      wasUntitled: false,
      suggestion: null,
    }
  }
  
  const suggestion = await generateDefaultTitle(sessionID)
  
  return {
    wasUntitled: true,
    suggestion,
  }
}
