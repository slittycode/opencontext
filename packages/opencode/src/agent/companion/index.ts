import path from "path"
import fs from "fs/promises"
import os from "os"
import { Log } from "../../util/log"

const log = Log.create({ service: "companion.index" })

/**
 * CompanionIndex maps session IDs to companion session metadata.
 * This index exists to solve the filtering problem: sessions don't store
 * agent name at the session level, only per message. Loading every session's
 * first message to check the agent field is too expensive.
 * 
 * The index provides a lightweight lookup: "which sessions belong to the companion agent."
 * Everything else (storage, history loading, persistence) is handled by the existing Session API.
 */
export type CompanionIndex = Record<
  string, // sessionID
  {
    title: string | null // null for untitled drafts
    lastModified: number // Unix timestamp (ms)
  }
>

/**
 * Get the path to the companion index directory.
 * Location: ~/.local/share/opencontext/companions/
 */
function getIndexDir(): string {
  const dataDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
  return path.join(dataDir, "opencontext", "companions")
}

/**
 * Get the path to the companion index file.
 * Location: ~/.local/share/opencontext/companions/index.json
 */
function getIndexPath(): string {
  return path.join(getIndexDir(), "index.json")
}

/**
 * Ensure the companion index directory exists.
 * Creates the directory if it doesn't exist.
 */
export async function ensureIndexDir(): Promise<void> {
  const dir = getIndexDir()
  try {
    await fs.mkdir(dir, { recursive: true })
    log.info("ensured index directory", { dir })
  } catch (error) {
    log.error("failed to create index directory", { dir, error })
    throw new Error(`Failed to create companion index directory: ${error}`)
  }
}

/**
 * Read the companion index from disk.
 * Returns an empty object if the file doesn't exist or can't be parsed.
 */
export async function readIndex(): Promise<CompanionIndex> {
  const indexPath = getIndexPath()
  
  try {
    const content = await fs.readFile(indexPath, "utf-8")
    const parsed = JSON.parse(content)
    log.info("read index", { sessionCount: Object.keys(parsed).length })
    return parsed as CompanionIndex
  } catch (error: any) {
    if (error.code === "ENOENT") {
      log.info("index file does not exist, returning empty index")
      return {}
    }
    log.error("failed to read or parse index file, returning empty index", { error })
    return {}
  }
}

/**
 * Write the companion index to disk atomically.
 * Uses a temp file + rename pattern to prevent corruption.
 */
export async function writeIndex(index: CompanionIndex): Promise<void> {
  await ensureIndexDir()
  
  const indexPath = getIndexPath()
  const tempPath = `${indexPath}.tmp`
  
  try {
    const content = JSON.stringify(index, null, 2)
    await fs.writeFile(tempPath, content, "utf-8")
    await fs.rename(tempPath, indexPath)
    log.info("wrote index", { sessionCount: Object.keys(index).length })
  } catch (error) {
    log.error("failed to write index", { error })
    // Clean up temp file if it exists
    await fs.unlink(tempPath).catch(() => {})
    throw new Error(`Failed to write companion index: ${error}`)
  }
}

/**
 * Sanitize a title for use as a filename component.
 * Rules:
 * 1. Convert to lowercase
 * 2. Replace spaces with hyphens
 * 3. Remove characters not in [a-z0-9-]
 * 4. Collapse multiple hyphens to single hyphen
 * 5. Trim hyphens from start/end
 * 6. Limit to 50 characters
 * 7. If empty after sanitization: use "session"
 */
export function sanitizeTitle(title: string): string {
  let sanitized = title
    .toLowerCase()
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/[^a-z0-9-]/g, "") // remove invalid chars
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-+|-+$/g, "") // trim hyphens from edges
    .slice(0, 50) // limit length
  
  if (!sanitized) {
    sanitized = "session"
  }
  
  return sanitized
}

/**
 * Add or update a session in the index.
 * If the session already exists, updates its title and lastModified.
 * If the session doesn't exist, adds it.
 */
export async function addSession(sessionID: string, title: string | null = null): Promise<void> {
  const index = await readIndex()
  
  index[sessionID] = {
    title,
    lastModified: Date.now(),
  }
  
  await writeIndex(index)
  log.info("added/updated session in index", { sessionID, title })
}

/**
 * Remove a session from the index.
 */
export async function removeSession(sessionID: string): Promise<void> {
  const index = await readIndex()
  
  if (index[sessionID]) {
    delete index[sessionID]
    await writeIndex(index)
    log.info("removed session from index", { sessionID })
  } else {
    log.warn("attempted to remove non-existent session from index", { sessionID })
  }
}

/**
 * List all companion sessions, sorted by lastModified descending (most recent first).
 * Returns an array of [sessionID, metadata] tuples.
 */
export async function listSessions(): Promise<Array<[string, { title: string | null; lastModified: number }]>> {
  const index = await readIndex()
  
  const sessions = Object.entries(index)
  
  // Sort by lastModified descending (most recent first)
  sessions.sort((a, b) => b[1].lastModified - a[1].lastModified)
  
  log.info("listed sessions", { count: sessions.length })
  return sessions
}
