import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { Discovery } from "../../src/skill/discovery"
import fs from "fs/promises"
import path from "path"

const INDEX = {
  skills: [
    {
      name: "agents-sdk",
      description: "agents sdk",
      files: ["SKILL.md", "references/overview.md"],
    },
    {
      name: "quick-start",
      description: "quick start",
      files: ["SKILL.md"],
    },
  ],
}

const FILES: Record<string, string> = {
  "/.well-known/skills/agents-sdk/SKILL.md": "# agents-sdk\n",
  "/.well-known/skills/agents-sdk/references/overview.md": "# reference\n",
  "/.well-known/skills/quick-start/SKILL.md": "# quick-start\n",
}

let server: Bun.Server<any> | undefined
let skillsUrl = ""
let nonJsonUrl = ""
let missingUrl = ""

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const pathname = new URL(req.url).pathname
      if (pathname === "/.well-known/skills/index.json") {
        return Response.json(INDEX)
      }
      if (pathname === "/.well-known/non-json-skills/index.json") {
        return new Response("<html>not json</html>", {
          headers: { "content-type": "text/html" },
        })
      }
      const file = FILES[pathname]
      if (file !== undefined) {
        return new Response(file, {
          headers: { "content-type": "text/markdown" },
        })
      }
      return new Response("not found", { status: 404 })
    },
  })
  const origin = `http://127.0.0.1:${server.port}`
  skillsUrl = `${origin}/.well-known/skills/`
  nonJsonUrl = `${origin}/.well-known/non-json-skills/`
  missingUrl = `${origin}/.well-known/missing-skills/`
})

afterAll(() => {
  server?.stop(true)
})

beforeEach(async () => {
  await fs.rm(Discovery.dir(), { recursive: true, force: true })
})

describe("Discovery.pull", () => {
  test("downloads skills from local index", async () => {
    const dirs = await Discovery.pull(skillsUrl)
    expect(dirs.length).toBeGreaterThan(0)
    for (const dir of dirs) {
      expect(dir).toStartWith(Discovery.dir())
      const md = path.join(dir, "SKILL.md")
      expect(await Bun.file(md).exists()).toBe(true)
    }
  })

  test("url without trailing slash works", async () => {
    const dirs = await Discovery.pull(skillsUrl.replace(/\/$/, ""))
    expect(dirs.length).toBeGreaterThan(0)
    for (const dir of dirs) {
      const md = path.join(dir, "SKILL.md")
      expect(await Bun.file(md).exists()).toBe(true)
    }
  })

  test("returns empty array for missing index", async () => {
    const dirs = await Discovery.pull(missingUrl)
    expect(dirs).toEqual([])
  })

  test("returns empty array for non-json response", async () => {
    const dirs = await Discovery.pull(nonJsonUrl)
    expect(dirs).toEqual([])
  })

  test("downloads reference files alongside SKILL.md", async () => {
    const dirs = await Discovery.pull(skillsUrl)
    // find a skill dir that should have reference files (e.g. agents-sdk)
    const agentsSdk = dirs.find((d) => d.endsWith("/agents-sdk"))
    if (agentsSdk) {
      const refs = path.join(agentsSdk, "references")
      expect(await Bun.file(path.join(agentsSdk, "SKILL.md")).exists()).toBe(true)
      // agents-sdk has reference files per the index
      const refDir = await Array.fromAsync(new Bun.Glob("**/*.md").scan({ cwd: refs, onlyFiles: true }))
      expect(refDir.length).toBeGreaterThan(0)
    }
  })

  test("caches downloaded files on second pull", async () => {
    // first pull to populate cache
    const first = await Discovery.pull(skillsUrl)
    expect(first.length).toBeGreaterThan(0)

    // second pull should return same results from cache
    const second = await Discovery.pull(skillsUrl)
    expect(second.length).toBe(first.length)
    expect(second.sort()).toEqual(first.sort())
  })
})
