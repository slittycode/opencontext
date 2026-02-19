import os from "os"
import path from "path"

export interface ResolveProjectDirectoryOptions {
  project?: string
  envPwd?: string
  cwd?: string
  homeDir?: string
}

function normalizeProjectInput(input: string, homeDir: string) {
  if (input === "~") return homeDir
  if (input.startsWith("~/")) return path.join(homeDir, input.slice(2))
  if (path.isAbsolute(input)) return input

  const homeWithoutLeadingSlash = homeDir.startsWith(path.sep) ? homeDir.slice(1) : homeDir
  if (
    homeWithoutLeadingSlash &&
    (input === homeWithoutLeadingSlash || input.startsWith(`${homeWithoutLeadingSlash}${path.sep}`))
  ) {
    return path.join(path.sep, input)
  }

  return input
}

export function resolveProjectDirectory(options: ResolveProjectDirectoryOptions) {
  const cwd = options.cwd ?? process.cwd()
  const homeDir = options.homeDir ?? os.homedir()
  const normalizedPwd = options.envPwd ? normalizeProjectInput(options.envPwd, homeDir) : undefined
  const baseCwd = normalizedPwd && path.isAbsolute(normalizedPwd) ? normalizedPwd : cwd

  if (!options.project) return cwd

  const normalizedProject = normalizeProjectInput(options.project, homeDir)
  return path.resolve(baseCwd, normalizedProject)
}
