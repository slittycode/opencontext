import { Session } from "../../session"
import { sanitizeTitle } from "./index"
import { Log } from "../../util/log"

const log = Log.create({ service: "companion.title-generator" })

/**
 * Generate a default title for a companion session.
 * 
 * Strategy:
 * 1. Get ALL messages from the session (Session.messages returns newest-first)
 * 2. Find the first user message in chronological order (last in the array)
 * 3. Extract text from the first text part
 * 4. Truncate to 50 characters and sanitize
 * 5. Fallback to "session-{date}" if no user messages found
 * 
 * @param sessionID - The session ID to generate a title for
 * @returns A sanitized title string suitable for use as a filename component
 */
export async function generateDefaultTitle(sessionID: string): Promise<string> {
  try {
    // Get ALL messages from the session
    // Note: Session.messages returns messages in reverse chronological order (newest first)
    // So we need to get all messages and find the last one (which is the first chronologically)
    const messages = await Session.messages({ sessionID })
    
    if (messages.length === 0) {
      log.info("no messages found, using date-based fallback", { sessionID })
      return generateDateBasedTitle()
    }
    
    // Find the first user message in chronological order
    // Since messages are newest-first, we iterate backwards to find the oldest user message
    let firstUserMessage = null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].info.role === "user") {
        firstUserMessage = messages[i]
        break
      }
    }
    
    if (!firstUserMessage) {
      log.info("no user messages found, using date-based fallback", { sessionID })
      return generateDateBasedTitle()
    }
    
    // Find the first text part
    const textPart = firstUserMessage.parts.find((part) => part.type === "text")
    
    if (!textPart || !("text" in textPart) || !textPart.text) {
      log.info("no text part found in first user message, using date-based fallback", { sessionID })
      return generateDateBasedTitle()
    }
    
    // Truncate to 50 characters and sanitize
    const truncated = textPart.text.slice(0, 50)
    const sanitized = sanitizeTitle(truncated)
    
    log.info("generated title from first user message", { sessionID, title: sanitized })
    return sanitized
  } catch (error) {
    log.error("failed to generate title, using date-based fallback", { sessionID, error })
    return generateDateBasedTitle()
  }
}

/**
 * Generate a date-based fallback title.
 * Format: "session-YYYY-MM-DD"
 */
function generateDateBasedTitle(): string {
  const date = new Date().toISOString().split("T")[0]
  return `session-${date}`
}
