import z from "zod"
import { Tool } from "./tool"
import { CareerMemory } from "@/memory/career"

const DESCRIPTION = `Career memory management tool for career agents.

Operations:
- save: Save information to career memory (profile, status, recent, archive)
- recall: Load all relevant memory for current context
- search: Search memory by query across all tiers
- pin: Pin an item to Core Profile (always loaded)
- forget: Remove an item from memory
- update-status: Update the user's current career status (researching, applied, interviewing, negotiating)`

const Params = z.object({
  operation: z
    .enum(["save", "recall", "search", "pin", "forget", "update-status"])
    .describe("The operation to perform"),
  tier: z.enum(["profile", "status", "recent", "archive"]).optional().describe("Which memory tier to operate on"),
  category: z.enum(["applications", "ideas"]).optional().describe("Category for archive entries"),
  content: z.string().optional().describe("Content to save"),
  query: z.string().optional().describe("Search query"),
  id: z.string().optional().describe("Specific entry ID"),
  key: z.string().optional().describe("Profile key to update (for profile updates)"),
  value: z.string().optional().describe("Value for profile key"),
  stage: z
    .enum(["researching", "applied", "interviewing", "negotiating"])
    .optional()
    .describe("Career stage for status update"),
})

type Params = z.infer<typeof Params>

export const CareerMemoryTool = Tool.define("career_memory", {
  description: DESCRIPTION,
  parameters: Params,
  async execute(params, ctx) {
    await ctx.ask({
      permission: "career_memory",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    switch (params.operation) {
      case "save":
        return await handleSave(params, ctx)
      case "recall":
        return await handleRecall(params)
      case "search":
        return await handleSearch(params)
      case "pin":
        return await handlePin(params)
      case "forget":
        return await handleForget(params)
      case "update-status":
        return await handleUpdateStatus(params)
      default:
        return {
          title: "Error",
          output: `Unknown operation: ${params.operation}`,
          metadata: {} as Record<string, any>,
        }
    }
  },
})

async function handleSave(params: Params, ctx: Tool.Context) {
  const { tier, category, content } = params

  if (!content) {
    return { title: "Error", output: "content is required for save operation", metadata: {} }
  }

  const processedContent = CareerMemory.processContent(content)

  try {
    switch (tier) {
      case "profile": {
        const profile = await CareerMemory.readProfile()
        if (params.key && params.value) {
          if (params.key === "targetRoles") {
            profile.targetRoles = [...profile.targetRoles, params.value].filter((v, i, a) => a.indexOf(v) === i)
          } else if (params.key === "skills") {
            profile.skills = [...profile.skills, params.value].filter((v, i, a) => a.indexOf(v) === i)
          } else if (params.key === "name") {
            profile.name = params.value
          } else if (params.key === "location") {
            profile.location = params.value
          } else if (params.key === "cvSummary") {
            profile.cvSummary = params.value
          }
          await CareerMemory.writeProfile(profile)
          return { title: "Profile Updated", output: `Updated ${params.key}: ${params.value}`, metadata: {} }
        }
        return { title: "Error", output: "key and value required for profile updates", metadata: {} }
      }

      case "status": {
        const status = await CareerMemory.readStatus()
        if (params.stage) {
          status.stage = params.stage
          status.updatedAt = Date.now()
          await CareerMemory.writeStatus(status)
          return { title: "Status Updated", output: `Updated status to: ${params.stage}`, metadata: {} }
        }
        return { title: "Error", output: "stage required for status updates", metadata: {} }
      }

      case "recent": {
        const recent = {
          sessionId: ctx.sessionID || "unknown",
          content: processedContent,
          timestamp: Date.now(),
          agentName: ctx.agent,
        }
        await CareerMemory.writeRecentContext(recent)
        return {
          title: "Saved to Recent",
          output: `Saved to recent context: ${processedContent.slice(0, 100)}...`,
          metadata: {},
        }
      }

      case "archive":
      default: {
        const archiveEntry = {
          id: CareerMemory.generateId(),
          category: category || "ideas",
          content: processedContent,
          createdAt: Date.now(),
        }
        await CareerMemory.writeArchiveEntry(archiveEntry)
        return {
          title: "Saved to Archive",
          output: `Saved to archive (${archiveEntry.category}): ${processedContent.slice(0, 100)}...`,
          metadata: { id: archiveEntry.id } as Record<string, any>,
        }
      }
    }
  } catch (error) {
    return { title: "Error", output: `Save failed: ${error}`, metadata: {} }
  }
}

async function handleRecall(params: Params) {
  try {
    const context = await CareerMemory.buildMemoryContext(5, { timeDecayFactor: 0.1 })
    return {
      title: "Career Memory",
      output: context || "No career memory found.",
      metadata: {},
    }
  } catch (error) {
    return { title: "Error", output: `Recall failed: ${error}`, metadata: {} }
  }
}

async function handleSearch(params: Params) {
  const { query } = params

  const normalizedQuery = query?.trim().toLowerCase()
  if (!normalizedQuery) {
    return { title: "Error", output: "query is required for search operation", metadata: {} }
  }

  try {
    const profile = await CareerMemory.readProfile()
    const status = await CareerMemory.readStatus()
    const archive = await CareerMemory.readArchive()

    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean)
    const matched = archive.filter((entry) => {
      const haystack = `${entry.content}\n${entry.summary ?? ""}\n${entry.category}\n${entry.id}`.toLowerCase()
      return haystack.includes(normalizedQuery) || queryTerms.every((term) => haystack.includes(term))
    })

    const ranked = CareerMemory.Scoring.rankEntries(matched, profile, status, { timeDecayFactor: 0.1 })
    const results = ranked.slice(0, 10)

    if (results.length === 0) {
      return { title: "No Results", output: `No memory entries found matching "${query}"`, metadata: {} }
    }

    const lines = results.map(
      (r) => `- **[${r.entry.category}]** Score ${r.score}: ${r.entry.summary || r.entry.content.slice(0, 100)}`,
    )

    return {
      title: `${results.length} Results`,
      output: `Found ${results.length} entries matching "${query}":\n\n${lines.join("\n")}`,
      metadata: {},
    }
  } catch (error) {
    return { title: "Error", output: `Search failed: ${error}`, metadata: {} }
  }
}

async function handlePin(params: Params) {
  const { id } = params

  if (!id) {
    return { title: "Error", output: "id is required for pin operation", metadata: {} }
  }

  try {
    const profile = await CareerMemory.readProfile()
    if (!profile.pinnedItems.includes(id)) {
      profile.pinnedItems.push(id)
      await CareerMemory.writeProfile(profile)
    }
    return { title: "Pinned", output: `Pinned item: ${id}`, metadata: {} }
  } catch (error) {
    return { title: "Error", output: `Pin failed: ${error}`, metadata: {} }
  }
}

async function handleForget(params: Params) {
  const { id, tier } = params

  try {
    if (tier === "recent" && id) {
      await CareerMemory.deleteRecentContext(id)
      return { title: "Deleted", output: `Deleted recent context: ${id}`, metadata: {} }
    }

    if (id) {
      await CareerMemory.deleteArchiveEntry(id)
      return { title: "Deleted", output: `Deleted from archive: ${id}`, metadata: {} }
    }

    return { title: "Error", output: "id is required for forget operation", metadata: {} }
  } catch (error) {
    return { title: "Error", output: `Forget failed: ${error}`, metadata: {} }
  }
}

async function handleUpdateStatus(params: Params) {
  const { stage, id } = params

  if (!stage) {
    return { title: "Error", output: "stage is required for update-status operation", metadata: {} }
  }

  try {
    const status = await CareerMemory.readStatus()
    status.stage = stage
    status.updatedAt = Date.now()

    if (id && !status.activeApplications.includes(id)) {
      status.activeApplications.push(id)
    }

    await CareerMemory.writeStatus(status)
    return { title: "Status Updated", output: `Updated status to: ${stage}`, metadata: {} }
  } catch (error) {
    return { title: "Error", output: `Update failed: ${error}`, metadata: {} }
  }
}
