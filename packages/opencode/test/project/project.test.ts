import { describe, expect, test } from "bun:test"
import path from "path"
import { Project } from "../../src/project/project"
import { Log } from "../../src/util/log"
import { Storage } from "../../src/storage/storage"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

describe("Project.fromDirectory", () => {
  test("uses folder-based IDs for non-git directories", async () => {
    await using tmp = await tmpdir()

    const { project, sandbox } = await Project.fromDirectory(tmp.path)

    expect(project).toBeDefined()
    expect(project.id).not.toBe("global")
    expect(project.id).toStartWith("folder-")
    expect(project.worktree).toBe(tmp.path)
    expect(project.vcs).toBeUndefined()
    expect(project.kind).toBe("context")
    expect(project.topic).toBeUndefined()
    expect(project.tags).toBeUndefined()
    expect(sandbox).toBe(tmp.path)
  })

  test("uses git-based IDs when git exists", async () => {
    await using tmp = await tmpdir({ git: true })

    const { project } = await Project.fromDirectory(tmp.path)

    // Git repos use root-commit-based IDs (upstream behavior)
    expect(project.id).not.toBe("global")
    expect(project.id).not.toStartWith("folder-")
    expect(project.vcs).toBe("git")
    expect(project.worktree).toBe(tmp.path)
    expect(project.sandboxes).toEqual([])
  })

  test("returns stable IDs for the same directory", async () => {
    await using tmp = await tmpdir()

    const one = await Project.fromDirectory(tmp.path)
    const two = await Project.fromDirectory(tmp.path)

    expect(one.project.id).toBe(two.project.id)
    expect(one.sandbox).toBe(two.sandbox)
    expect(two.project.kind).toBe("context")
  })

  test("returns different IDs for different directories", async () => {
    await using one = await tmpdir()
    await using two = await tmpdir()

    const first = await Project.fromDirectory(one.path)
    const second = await Project.fromDirectory(two.path)

    expect(first.project.id).not.toBe(second.project.id)
  })
})

describe("Project.discover", () => {
  test("discovers favicon.png in root for git projects", async () => {
    await using tmp = await tmpdir({ git: true })
    const { project } = await Project.fromDirectory(tmp.path)

    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await Bun.write(path.join(tmp.path, "favicon.png"), pngData)

    await Project.discover(project)

    const updated = await Storage.read<Project.Info>(["project", project.id])
    expect(updated.icon).toBeDefined()
    expect(updated.icon?.url).toStartWith("data:")
    expect(updated.icon?.url).toContain("base64")
    expect(updated.icon?.color).toBeUndefined()
  })

  test("does not discover favicon for non-git projects", async () => {
    await using tmp = await tmpdir()
    const { project } = await Project.fromDirectory(tmp.path)

    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await Bun.write(path.join(tmp.path, "favicon.png"), pngData)

    await Project.discover(project)

    const updated = await Storage.read<Project.Info>(["project", project.id])
    expect(updated.icon).toBeUndefined()
  })
})

describe("Project trust", () => {
  test("setProjectConfigTrust persists trust state", async () => {
    await using tmp = await tmpdir()
    const { project } = await Project.fromDirectory(tmp.path)

    expect(Project.isProjectConfigTrusted(project)).toBe(false)

    const trusted = await Project.setProjectConfigTrust(project.id, true)
    expect(trusted.trust?.projectConfig).toBe(true)
    expect(Project.isProjectConfigTrusted(trusted)).toBe(true)

    const untrusted = await Project.setProjectConfigTrust(project.id, false)
    expect(untrusted.trust?.projectConfig).toBe(false)
    expect(Project.isProjectConfigTrusted(untrusted)).toBe(false)
  })

  test("OPENCODE_TRUST_PROJECT env override forces trusted state", async () => {
    const prev = process.env.OPENCODE_TRUST_PROJECT
    process.env.OPENCODE_TRUST_PROJECT = "1"
    try {
      expect(Project.isProjectConfigTrusted({ trust: { projectConfig: false } })).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_TRUST_PROJECT
      else process.env.OPENCODE_TRUST_PROJECT = prev
    }
  })

  test("Project.update can persist trust state", async () => {
    await using tmp = await tmpdir()
    const { project } = await Project.fromDirectory(tmp.path)

    const updated = await Project.update({
      projectID: project.id,
      trust: { projectConfig: true },
    })
    expect(updated.trust?.projectConfig).toBe(true)
  })
})
