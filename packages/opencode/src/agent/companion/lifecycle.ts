import { Bus } from "../../bus"
import { Session } from "../../session"
import { listSessions, addSession } from "./index"
import { Log } from "../../util/log"

const log = Log.create({ service: "companion.lifecycle" })

export function initCompanionLifecycle(): void {
  log.info("initializing companion lifecycle hooks")

  Bus.subscribe(Session.Event.Updated, async (evt) => {
    try {
      const sessionID = evt.properties.info.id
      const sessions = await listSessions()
      const companionSession = sessions.find(([id]) => id === sessionID)

      if (!companionSession) {
        return
      }

      const currentTitle = companionSession[1].title
      await addSession(sessionID, currentTitle)

      log.debug("updated companion session lastModified", { sessionID, title: currentTitle })
    } catch (error) {
      log.error("failed to update companion session index", { error })
    }
  })

  Bus.subscribe(Session.Event.Deleted, async (evt) => {
    try {
      const sessionID = evt.properties.info.id
      const sessions = await listSessions()
      const companionSession = sessions.find(([id]) => id === sessionID)

      if (companionSession) {
        const { removeSession } = await import("./index")
        await removeSession(sessionID)
        log.info("removed companion session from index", { sessionID })
      }
    } catch (error) {
      log.error("failed to remove companion session from index", { error })
    }
  })

  log.info("companion lifecycle hooks initialized")
}

export async function isCompanionSession(sessionID: string): Promise<boolean> {
  const sessions = await listSessions()
  return sessions.some(([id]) => id === sessionID)
}
