import { describe, expect, test } from "bun:test"
import path from "path"
import type { PermissionNext } from "../../src/permission/next"
import type { Tool } from "../../src/tool/tool"
import { CareerMemoryTool } from "../../src/tool/career-memory"
import { CareerMemory } from "../../src/memory/career"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

const baseCtx: Omit<Tool.Context, "ask"> = {
  sessionID: "test-session",
  messageID: "",
  callID: "",
  agent: "career-strategist",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
}

function buildCtx(requests?: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">>): Tool.Context {
  return {
    ...baseCtx,
    ask: async (req) => {
      requests?.push(req)
    },
  }
}

async function withIsolatedCareerMemory(tmpPath: string, fn: () => Promise<void>) {
  const originalDir = CareerMemory.dir
  const originalRecentDir = CareerMemory.recentDir
  const originalArchiveDir = CareerMemory.archiveDir

  ;(CareerMemory as any).dir = () => path.join(tmpPath, ".career-memory")
  ;(CareerMemory as any).recentDir = () => path.join(tmpPath, ".career-memory", "recent")
  ;(CareerMemory as any).archiveDir = () => path.join(tmpPath, ".career-memory", "archive")

  try {
    await CareerMemory.initialize()
    await fn()
  } finally {
    ;(CareerMemory as any).dir = originalDir
    ;(CareerMemory as any).recentDir = originalRecentDir
    ;(CareerMemory as any).archiveDir = originalArchiveDir
  }
}

describe("tool.career_memory", () => {
  test("save profile update succeeds without content", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await withIsolatedCareerMemory(tmp.path, async () => {
          const tool = await CareerMemoryTool.init()
          const requests: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">> = []
          const result = await tool.execute(
            {
              operation: "save",
              tier: "profile",
              key: "name",
              value: "Alex",
            },
            buildCtx(requests),
          )

          expect(result.title).toBe("Profile Updated")
          expect(result.output).toContain("Updated name: Alex")
          const profile = await CareerMemory.readProfile()
          expect(profile.name).toBe("Alex")
          expect(requests.length).toBe(1)
          expect(requests[0].permission).toBe("career_memory")
        })
      },
    })
  })

  test("save status update succeeds without content", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await withIsolatedCareerMemory(tmp.path, async () => {
          const tool = await CareerMemoryTool.init()
          const result = await tool.execute(
            {
              operation: "save",
              tier: "status",
              stage: "interviewing",
            },
            buildCtx(),
          )

          expect(result.title).toBe("Status Updated")
          expect(result.output).toContain("interviewing")
          const status = await CareerMemory.readStatus()
          expect(status.stage).toBe("interviewing")
        })
      },
    })
  })

  test("save recent without content still returns validation error", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await withIsolatedCareerMemory(tmp.path, async () => {
          const tool = await CareerMemoryTool.init()
          const result = await tool.execute(
            {
              operation: "save",
              tier: "recent",
            },
            buildCtx(),
          )

          expect(result.title).toBe("Error")
          expect(result.output).toContain("content is required")
        })
      },
    })
  })

  test("save archive without content still returns validation error", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await withIsolatedCareerMemory(tmp.path, async () => {
          const tool = await CareerMemoryTool.init()
          const result = await tool.execute(
            {
              operation: "save",
              tier: "archive",
            },
            buildCtx(),
          )

          expect(result.title).toBe("Error")
          expect(result.output).toContain("content is required")
        })
      },
    })
  })

  test("recall uses configured career.memory.timeDecayFactor", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        career: {
          memory: {
            timeDecayFactor: 0.42,
          },
        },
      } as any,
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await withIsolatedCareerMemory(tmp.path, async () => {
          const originalBuildMemoryContext = CareerMemory.buildMemoryContext
          let observed: { timeDecayFactor: number } | undefined

          ;(CareerMemory as any).buildMemoryContext = async (_topN: number, config: { timeDecayFactor: number }) => {
            observed = config
            return "mock-memory-context"
          }

          try {
            const tool = await CareerMemoryTool.init()
            const result = await tool.execute({ operation: "recall" }, buildCtx())
            expect(result.title).toBe("Career Memory")
            expect(result.output).toContain("mock-memory-context")
            expect(observed?.timeDecayFactor).toBe(0.42)
          } finally {
            ;(CareerMemory as any).buildMemoryContext = originalBuildMemoryContext
          }
        })
      },
    })
  })

  test("search uses configured career.memory.timeDecayFactor", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        career: {
          memory: {
            timeDecayFactor: 0.42,
          },
        },
      } as any,
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await withIsolatedCareerMemory(tmp.path, async () => {
          const originalRankEntries = CareerMemory.Scoring.rankEntries
          let observed: { timeDecayFactor: number } | undefined

          ;(CareerMemory.Scoring as any).rankEntries = (
            entries: any[],
            profile: any,
            status: any,
            config: { timeDecayFactor: number },
          ) => {
            observed = config
            return originalRankEntries(entries, profile, status, config)
          }

          try {
            const tool = await CareerMemoryTool.init()
            const result = await tool.execute({ operation: "search", query: "anything" }, buildCtx())
            expect(result.title).toBe("No Results")
            expect(observed?.timeDecayFactor).toBe(0.42)
          } finally {
            ;(CareerMemory.Scoring as any).rankEntries = originalRankEntries
          }
        })
      },
    })
  })

  test("recall defaults timeDecayFactor to 0.1 when config is missing", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await withIsolatedCareerMemory(tmp.path, async () => {
          const originalBuildMemoryContext = CareerMemory.buildMemoryContext
          let observed: { timeDecayFactor: number } | undefined

          ;(CareerMemory as any).buildMemoryContext = async (_topN: number, config: { timeDecayFactor: number }) => {
            observed = config
            return "mock-memory-context"
          }

          try {
            const tool = await CareerMemoryTool.init()
            await tool.execute({ operation: "recall" }, buildCtx())
            expect(observed?.timeDecayFactor).toBe(0.1)
          } finally {
            ;(CareerMemory as any).buildMemoryContext = originalBuildMemoryContext
          }
        })
      },
    })
  })
})
