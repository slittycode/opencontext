import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./context-store.txt"
import {
  contextDir,
  deleteContextEntry,
  listContextEntries,
  readContextEntry,
  saveContextEntry,
  searchContextEntries,
} from "@/context-store/service"

export const ContextStoreTool = Tool.define("context_store", {
  description: DESCRIPTION,
  parameters: z.object({
    operation: z.enum(["save", "search", "list", "read", "delete"]).describe("The operation to perform"),
    category: z
      .string()
      .optional()
      .describe('Category/folder for the entry (e.g., "concepts", "research", "notes", "decisions")'),
    title: z.string().optional().describe("Title for the entry"),
    content: z.string().optional().describe("Markdown content to save"),
    query: z.string().optional().describe("Search query string"),
    path: z.string().optional().describe("Specific entry path to read or delete"),
    tags: z.array(z.string()).optional().describe("Tags for the entry"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "context_store",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const result = await (async () => {
      switch (params.operation) {
        case "save":
          return handleSave(params, ctx)
        case "search":
          return handleSearch(params)
        case "list":
          return handleList(params)
        case "read":
          return handleRead(params)
        case "delete":
          return handleDelete(params)
        default:
          return {
            title: "Error",
            output: `Unknown operation: ${params.operation}`,
            metadata: {} as Record<string, any>,
          }
      }
    })()

    return {
      title: result.title,
      output: result.output,
      metadata: result.metadata as Record<string, any>,
    }
  },
})

async function handleSave(
  params: { category?: string; title?: string; content?: string; tags?: string[] },
  ctx: Tool.Context,
) {
  if (!params.title) {
    return { title: "Error", output: "title is required for save operation", metadata: {} }
  }
  if (!params.content) {
    return { title: "Error", output: "content is required for save operation", metadata: {} }
  }

  const entry = await saveContextEntry({
    title: params.title,
    content: params.content,
    category: params.category,
    tags: params.tags,
    createdBy: ctx.agent,
  })

  return {
    title: `Saved: ${entry.path}`,
    output: `Knowledge entry saved to .context/${entry.path}\nCategory: ${entry.category}\nTags: ${entry.tags.join(", ") || "none"}`,
    metadata: { path: entry.path, operation: "save" },
  }
}

async function handleSearch(params: { query?: string; category?: string }) {
  if (!params.query) {
    return { title: "Error", output: "query is required for search operation", metadata: {} }
  }

  const matches = await searchContextEntries({
    query: params.query,
    category: params.category,
  })

  if (matches.length === 0) {
    return {
      title: "No results",
      output: `No knowledge entries found matching "${params.query}"`,
      metadata: { matches: 0 },
    }
  }

  const lines = matches.map(
    (entry) =>
      `- **${entry.title}** (.context/${entry.path})\n  Category: ${entry.category} | Tags: ${entry.tags.join(", ") || "none"} | Updated: ${new Date(entry.updatedAt).toISOString().split("T")[0]}`,
  )

  return {
    title: `${matches.length} results`,
    output: `Found ${matches.length} entries matching "${params.query}":\n\n${lines.join("\n")}`,
    metadata: { matches: matches.length },
  }
}

async function handleList(params: { category?: string }) {
  const entries = await listContextEntries({ category: params.category })

  if (entries.length === 0) {
    const suffix = params.category ? ` in category "${params.category}"` : ""
    return {
      title: "Empty",
      output: `No knowledge entries found${suffix}. Use the save operation to add entries.`,
      metadata: { count: 0 },
    }
  }

  const grouped = new Map<string, typeof entries>()
  for (const entry of entries) {
    const bucket = grouped.get(entry.category) ?? []
    bucket.push(entry)
    grouped.set(entry.category, bucket)
  }

  const sections: string[] = []
  for (const [category, items] of grouped) {
    const lines = items
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(
        (entry) =>
          `  - ${entry.title} (${entry.tags.join(", ") || "no tags"}) — ${new Date(entry.updatedAt).toISOString().split("T")[0]}`,
      )
    sections.push(`### ${category}\n${lines.join("\n")}`)
  }

  return {
    title: `${entries.length} entries`,
    output: `Knowledge store: ${entries.length} entries across ${grouped.size} categories\n\n${sections.join("\n\n")}`,
    metadata: { count: entries.length, categories: grouped.size },
  }
}

async function handleRead(params: { path?: string }) {
  if (!params.path) {
    return { title: "Error", output: "path is required for read operation", metadata: {} }
  }

  try {
    const entry = await readContextEntry({ entryPath: params.path })
    return {
      title: `Read: ${entry.path}`,
      output: entry.content,
      metadata: { path: entry.path, operation: "read" },
    }
  } catch {
    const cleanPath = params.path.replace(/^\.context\//, "")
    return {
      title: "Not found",
      output: `No knowledge entry found at .context/${cleanPath}`,
      metadata: { path: cleanPath },
    }
  }
}

async function handleDelete(params: { path?: string }) {
  if (!params.path) {
    return { title: "Error", output: "path is required for delete operation", metadata: {} }
  }

  try {
    const cleanPath = await deleteContextEntry({ entryPath: params.path })
    return {
      title: `Deleted: ${cleanPath}`,
      output: `Knowledge entry removed from .context/${cleanPath}`,
      metadata: { path: cleanPath, operation: "delete" },
    }
  } catch {
    const cleanPath = params.path.replace(/^\.context\//, "")
    return {
      title: "Not found",
      output: `No knowledge entry found at .context/${cleanPath}`,
      metadata: { path: cleanPath },
    }
  }
}

// Re-export path helper for UI-oriented diagnostics or future routes.
export { contextDir }
