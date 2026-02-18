import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { buildDevUpdateArgs, findDevRepo } from "../../src/cli/cmd/dev-update"
import { tmpdir } from "../fixture/fixture"

async function scaffoldRepo(root: string) {
  await fs.mkdir(path.join(root, "packages", "opencode", "script"), { recursive: true })
  await Bun.write(path.join(root, "packages", "opencode", "script", "build.ts"), "export {}")
}

describe("findDevRepo", () => {
  test("finds repo from root path", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await scaffoldRepo(dir)
      },
    })

    const found = findDevRepo({ startPath: tmp.path })
    expect(found?.root).toBe(tmp.path)
    expect(found?.packageDir).toBe(path.join(tmp.path, "packages", "opencode"))
  })

  test("finds repo from packages/opencode path", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await scaffoldRepo(dir)
      },
    })

    const packageDir = path.join(tmp.path, "packages", "opencode")
    const found = findDevRepo({ startPath: packageDir })
    expect(found?.root).toBe(tmp.path)
    expect(found?.packageDir).toBe(packageDir)
  })

  test("finds repo from binary exec path", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await scaffoldRepo(dir)
        const binaryPath = path.join(dir, "packages", "opencode", "dist", "opencontext-darwin-arm64", "bin")
        await fs.mkdir(binaryPath, { recursive: true })
        await Bun.write(path.join(binaryPath, "opencontext"), "")
      },
    })

    const execPath = path.join(tmp.path, "packages", "opencode", "dist", "opencontext-darwin-arm64", "bin", "opencontext")
    const found = findDevRepo({ startPath: "/", execPath })
    expect(found?.root).toBe(tmp.path)
    expect(found?.packageDir).toBe(path.join(tmp.path, "packages", "opencode"))
  })

  test("returns undefined when no repo markers exist", () => {
    const found = findDevRepo({ startPath: "/" })
    expect(found).toBeUndefined()
  })
})

describe("buildDevUpdateArgs", () => {
  test("uses single + skip-install by default", () => {
    expect(buildDevUpdateArgs(false)).toEqual(["--single", "--skip-install"])
  })

  test("forwards keep-bun-build when requested", () => {
    expect(buildDevUpdateArgs(true)).toEqual(["--single", "--skip-install", "--keep-bun-build"])
  })
})
