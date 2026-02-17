import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import { UI } from "../ui"
import { Flag } from "../../flag/flag"

const ACTIONS = ["status", "enable", "disable"] as const
type Action = (typeof ACTIONS)[number]

function printStatus(input: { trusted: boolean; trustedByProject: boolean; trustedByEnv: boolean; worktree: string }) {
  UI.println(UI.Style.TEXT_INFO_BOLD + "Workspace" + UI.Style.TEXT_NORMAL + ` ${input.worktree}`)
  UI.println(
    UI.Style.TEXT_INFO_BOLD + "Extensions" + UI.Style.TEXT_NORMAL + ` ${input.trusted ? "trusted" : "untrusted"}`,
  )

  if (input.trustedByEnv) {
    UI.println(
      UI.Style.TEXT_DIM + "Trust source: OPENCODE_TRUST_PROJECT=1 (environment override)" + UI.Style.TEXT_NORMAL,
    )
    return
  }

  if (input.trustedByProject) {
    UI.println(UI.Style.TEXT_DIM + "Trust source: project setting" + UI.Style.TEXT_NORMAL)
    return
  }

  UI.println(UI.Style.TEXT_DIM + "Trust source: default deny" + UI.Style.TEXT_NORMAL)
  UI.println(
    UI.Style.TEXT_DIM +
      "Project-local .opencontext/.opencode commands, agents, plugins, and tools are disabled until trusted." +
      UI.Style.TEXT_NORMAL,
  )
}

export const TrustCommand = cmd({
  command: "trust [action]",
  describe: "manage trust for project-local .opencontext/.opencode extensions",
  builder: (yargs: Argv) =>
    yargs.positional("action", {
      describe: "status (default), enable, or disable workspace extension trust",
      choices: ACTIONS,
      default: "status",
    }),
  handler: async (args) => {
    const action = (args.action ?? "status") as Action
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const project = Instance.project
        const trustedByProject = project.trust?.projectConfig === true
        const trustedByEnv = Flag.OPENCODE_TRUST_PROJECT
        const trusted = Project.isProjectConfigTrusted(project)

        if (action === "status") {
          printStatus({
            trusted,
            trustedByProject,
            trustedByEnv,
            worktree: project.worktree,
          })
          return
        }

        if (action === "enable") {
          if (!trustedByProject) {
            await Project.setProjectConfigTrust(project.id, true)
          }
          UI.println(
            UI.Style.TEXT_SUCCESS_BOLD +
              "Trusted" +
              UI.Style.TEXT_NORMAL +
              " project-local .opencontext/.opencode extensions for this workspace.",
          )
          printStatus({
            trusted: true,
            trustedByProject: true,
            trustedByEnv,
            worktree: project.worktree,
          })
          return
        }

        await Project.setProjectConfigTrust(project.id, false)
        UI.println(
          UI.Style.TEXT_WARNING_BOLD +
            "Untrusted" +
            UI.Style.TEXT_NORMAL +
            " project-local .opencontext/.opencode extensions for this workspace.",
        )
        if (trustedByEnv) {
          UI.println(
            UI.Style.TEXT_DIM +
              "Note: OPENCODE_TRUST_PROJECT=1 is set, so extensions remain trusted for this process." +
              UI.Style.TEXT_NORMAL,
          )
        }
        printStatus({
          trusted: trustedByEnv,
          trustedByProject: false,
          trustedByEnv,
          worktree: project.worktree,
        })
      },
    })
  },
})
