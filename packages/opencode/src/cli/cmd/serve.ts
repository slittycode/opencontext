import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencontext server",
  handler: async (args) => {
    const opts = await resolveNetworkOptions(args)

    try {
      Server.assertSecureServerConfig(opts.hostname)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return
    }

    if (!Flag.OPENCODE_SERVER_PASSWORD && Server.isLoopbackHostname(opts.hostname)) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is only safe for loopback use.")
    }

    const server = Server.listen(opts)
    console.log(`opencontext server listening on http://${server.hostname}:${server.port}`)
    await new Promise(() => {})
    await server.stop()
  },
})
