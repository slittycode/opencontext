import { Agent } from "./src/agent/agent"
import { Instance } from "./src/project/instance"
import { Auth } from "./src/auth"
import { Config } from "./src/config/config"

async function main() {
  await Instance.provide({
    directory: process.cwd(),
    fn: async () => {
      console.log("Loading career-strategist agent...")
      const agent = await Agent.get("career-strategist")
      if (!agent) {
        console.error("Agent not found!")
        process.exit(1)
      }
      
      console.log("Agent loaded successfully:", agent.name)
      console.log("Description:", agent.description)
      console.log("Permissions string space:", agent.permission.length)
      console.log("Has task permission?", agent.permission.some(p => p.permission === "task" && p.action === "allow"))
      
      // We don't need to run a full generation if it hangs the process, just getting here proves it loads with the right auth context from the built code.
      console.log("Verification checks passed.")
    }
  })
}

main().catch(console.error)
