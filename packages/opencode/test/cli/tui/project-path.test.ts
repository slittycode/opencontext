import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveProjectDirectory } from "../../../src/cli/cmd/tui/project-path"

describe("resolveProjectDirectory", () => {
  const repo = path.join(path.sep, "tmp", "opencontext")
  const home = path.join(path.sep, "Users", "chris")
  const homeWithoutLeadingSlash = home.startsWith(path.sep) ? home.slice(1) : home

  test("resolves relative project against absolute PWD", () => {
    expect(resolveProjectDirectory({ project: "packages", envPwd: repo, cwd: repo, homeDir: home })).toBe(
      path.join(repo, "packages"),
    )
  })

  test("falls back to cwd when PWD is non-absolute", () => {
    expect(resolveProjectDirectory({ project: ".", envPwd: "relative/pwd", cwd: repo, homeDir: home })).toBe(repo)
  })

  test("repairs missing leading slash in PWD when it matches home", () => {
    expect(resolveProjectDirectory({ project: ".", envPwd: homeWithoutLeadingSlash, cwd: repo, homeDir: home })).toBe(
      home,
    )
  })

  test("repairs missing leading slash in project argument when it matches home", () => {
    expect(
      resolveProjectDirectory({
        project: homeWithoutLeadingSlash,
        envPwd: repo,
        cwd: repo,
        homeDir: home,
      }),
    ).toBe(home)
  })

  test("expands tilde project", () => {
    expect(resolveProjectDirectory({ project: "~/work", envPwd: repo, cwd: repo, homeDir: home })).toBe(
      path.join(home, "work"),
    )
  })
})
