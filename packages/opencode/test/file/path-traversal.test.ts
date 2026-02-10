import { test, expect, describe } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { Filesystem } from "../../src/util/filesystem"
import { File } from "../../src/file"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

describe("Filesystem.contains", () => {
  test("allows paths within project", () => {
    expect(Filesystem.contains("/project", "/project/src")).toBe(true)
    expect(Filesystem.contains("/project", "/project/src/file.ts")).toBe(true)
    expect(Filesystem.contains("/project", "/project")).toBe(true)
  })

  test("blocks ../ traversal", () => {
    expect(Filesystem.contains("/project", "/project/../etc")).toBe(false)
    expect(Filesystem.contains("/project", "/project/src/../../etc")).toBe(false)
    expect(Filesystem.contains("/project", "/etc/passwd")).toBe(false)
  })

  test("blocks absolute paths outside project", () => {
    expect(Filesystem.contains("/project", "/etc/passwd")).toBe(false)
    expect(Filesystem.contains("/project", "/tmp/file")).toBe(false)
    expect(Filesystem.contains("/home/user/project", "/home/user/other")).toBe(false)
  })

  test("handles prefix collision edge cases", () => {
    expect(Filesystem.contains("/project", "/project-other/file")).toBe(false)
    expect(Filesystem.contains("/project", "/projectfile")).toBe(false)
  })

  test("blocks symlink escapes when target exists outside project", async () => {
    await using outside = await tmpdir({
      init: async (dir) => {
        const outsideFile = path.join(dir, "outside.txt")
        await Bun.write(outsideFile, "outside content")
        return { outsideFile }
      },
    })

    await using project = await tmpdir({
      init: async (dir) => {
        const linkPath = path.join(dir, "escape-link.txt")
        try {
          await fs.symlink(outside.extra.outsideFile, linkPath)
        } catch (error: any) {
          if (process.platform === "win32" && (error?.code === "EPERM" || error?.code === "EINVAL")) return
          throw error
        }
      },
    })

    const link = path.join(project.path, "escape-link.txt")
    if (!(await Bun.file(link).exists())) return
    expect(Filesystem.contains(project.path, link)).toBe(false)
  })
})

/*
 * Integration tests for File.read() and File.list() path traversal protection.
 *
 * These tests verify the HTTP API code path is protected. The HTTP endpoints
 * in server.ts (GET /file/content, GET /file) call File.read()/File.list()
 * directly - they do NOT go through ReadTool or the agent permission layer.
 *
 * This is a SEPARATE code path from ReadTool, which has its own checks.
 */
describe("File.read path traversal protection", () => {
  test("rejects ../ traversal attempting to read /etc/passwd", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "allowed.txt"), "allowed content")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await expect(File.read("../../../etc/passwd")).rejects.toThrow("Access denied: path escapes project directory")
      },
    })
  })

  test("rejects deeply nested traversal", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await expect(File.read("src/nested/../../../../../../../etc/passwd")).rejects.toThrow(
          "Access denied: path escapes project directory",
        )
      },
    })
  })

  test("allows valid paths within project", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "valid.txt"), "valid content")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const result = await File.read("valid.txt")
        expect(result.content).toBe("valid content")
      },
    })
  })

  test("rejects symlink that resolves outside project", async () => {
    await using outside = await tmpdir({
      init: async (dir) => {
        const outsideFile = path.join(dir, "outside.txt")
        await Bun.write(outsideFile, "outside content")
        return { outsideFile }
      },
    })

    await using project = await tmpdir({
      init: async (dir) => {
        try {
          await fs.symlink(outside.extra.outsideFile, path.join(dir, "escape-link.txt"))
        } catch (error: any) {
          if (process.platform === "win32" && (error?.code === "EPERM" || error?.code === "EINVAL")) return
          throw error
        }
      },
    })

    const link = path.join(project.path, "escape-link.txt")
    if (!(await Bun.file(link).exists())) return

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await expect(File.read("escape-link.txt")).rejects.toThrow("Access denied: path escapes project directory")
      },
    })
  })

  test("preserves leading/trailing whitespace and trailing newlines", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "whitespace.txt"), "  leading\nmiddle  \n\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const result = await File.read("whitespace.txt")
        expect(result.content).toBe("  leading\nmiddle  \n\n")
      },
    })
  })
})

describe("File.list path traversal protection", () => {
  test("rejects ../ traversal attempting to list /etc", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await expect(File.list("../../../etc")).rejects.toThrow("Access denied: path escapes project directory")
      },
    })
  })

  test("allows valid subdirectory listing", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "subdir", "file.txt"), "content")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const result = await File.list("subdir")
        expect(Array.isArray(result)).toBe(true)
      },
    })
  })
})

describe("Instance.containsPath", () => {
  test("returns true for path inside directory", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: () => {
        expect(Instance.containsPath(path.join(tmp.path, "foo.txt"))).toBe(true)
        expect(Instance.containsPath(path.join(tmp.path, "src", "file.ts"))).toBe(true)
      },
    })
  })

  test("returns false for paths outside directory when running from monorepo subdirectory", async () => {
    await using tmp = await tmpdir({ git: true })
    const subdir = path.join(tmp.path, "packages", "lib")
    await fs.mkdir(subdir, { recursive: true })

    await Instance.provide({
      directory: subdir,
      fn: () => {
        // With git-based detection, worktree resolves to the git root (tmp.path),
        // while directory is the subdirectory. For non-git dirs they'd be equal.
        expect(Instance.directory).toBe(subdir)
        // Paths outside both directory and worktree are external.
        expect(Instance.containsPath("/etc/passwd")).toBe(false)
        expect(Instance.containsPath("/tmp/other-project/file.ts")).toBe(false)
      },
    })
  })

  test("returns false for path outside both directory and worktree", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: () => {
        expect(Instance.containsPath("/etc/passwd")).toBe(false)
        expect(Instance.containsPath("/tmp/other-project")).toBe(false)
      },
    })
  })

  test("returns false for path with .. escaping worktree", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: () => {
        expect(Instance.containsPath(path.join(tmp.path, "..", "escape.txt"))).toBe(false)
      },
    })
  })

  test("handles directory === worktree (running from repo root)", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: () => {
        expect(Instance.directory).toBe(Instance.worktree)
        expect(Instance.containsPath(path.join(tmp.path, "file.txt"))).toBe(true)
        expect(Instance.containsPath("/etc/passwd")).toBe(false)
      },
    })
  })

  test("non-git project does not allow arbitrary paths via worktree='/'", async () => {
    await using tmp = await tmpdir() // no git: true

    await Instance.provide({
      directory: tmp.path,
      fn: () => {
        // worktree is "/" for non-git projects, but containsPath should NOT allow all paths
        expect(Instance.containsPath(path.join(tmp.path, "file.txt"))).toBe(true)
        expect(Instance.containsPath("/etc/passwd")).toBe(false)
        expect(Instance.containsPath("/tmp/other")).toBe(false)
      },
    })
  })
})

describe("File.status", () => {
  test("reports repo-relative paths and accurate line counts for untracked files", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "empty.txt"), "")
        await Bun.write(path.join(dir, "one-line.txt"), "hello\n")
        await Bun.write(path.join(dir, "nested", "no-newline.txt"), "alpha")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const status = await File.status()
        const normalize = (p: string) => p.replaceAll("\\", "/")
        const byPath = new Map(status.map((entry) => [normalize(entry.path), entry]))

        expect(byPath.get("empty.txt")?.status).toBe("added")
        expect(byPath.get("empty.txt")?.added).toBe(0)
        expect(byPath.get("one-line.txt")?.added).toBe(1)
        expect(byPath.get("nested/no-newline.txt")?.added).toBe(1)

        for (const entry of status) {
          expect(path.isAbsolute(entry.path)).toBe(false)
          expect(normalize(entry.path).startsWith("../")).toBe(false)
        }
      },
    })
  })
})
