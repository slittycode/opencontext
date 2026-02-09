import z from "zod"
import path from "path"
import fs from "fs/promises"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import DESCRIPTION from "./context-store.txt"

/**
 * Manifest schema for the .context/ directory.
 * Tracks metadata about each knowledge entry.
 */
const ManifestEntry = z.object({
  path: z.string(),
  title: z.string(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  createdBy: z.string().optional(),
  summary: z.string().optional(),
})
type ManifestEntry = z.infer<typeof ManifestEntry>

const Manifest = z.object({
  version: z.literal(1),
  entries: z.array(ManifestEntry),
})
type Manifest = z.infer<typeof Manifest>

function contextDir(): string {
  return path.join(Instance.directory, ".context")
}

function manifestPath(): string {
  return path.join(contextDir(), "manifest.json")
}

async function readManifest(): Promise<Manifest> {
  try {
    const raw = await Bun.file(manifestPath()).text()
    return Manifest.parse(JSON.parse(raw))
  } catch {
    return { version: 1, entries: [] }
  }
}

async function writeManifest(manifest: Manifest): Promise<void> {
  const dir = contextDir()
  await fs.mkdir(dir, { recursive: true })
  await Bun.write(manifestPath(), JSON.stringify(manifest, null, 2))
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

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
          return await handleSave(params, ctx)
        case "search":
          return await handleSearch(params)
        case "list":
          return await handleList(params)
        case "read":
          return await handleRead(params)
        case "delete":
          return await handleDelete(params)
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

  const category = params.category ?? "general"
  const filename = toKebabCase(params.title) + ".md"
  const relativePath = path.join(category, filename)
  const fullPath = path.join(contextDir(), relativePath)

  // Ensure the category directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true })

  // Build the frontmatter
  const now = Date.now()
  const frontmatter = [
    "---",
    `title: "${params.title}"`,
    `category: "${category}"`,
    `created: ${new Date(now).toISOString()}`,
    `updated: ${new Date(now).toISOString()}`,
    ...(params.tags?.length ? [`tags: [${params.tags.map((t) => `"${t}"`).join(", ")}]`] : []),
    `agent: "${ctx.agent}"`,
    "---",
    "",
  ].join("\n")

  await Bun.write(fullPath, frontmatter + params.content)

  // Update manifest
  const manifest = await readManifest()
  const existingIdx = manifest.entries.findIndex((e) => e.path === relativePath)
  const entry: ManifestEntry = {
    path: relativePath,
    title: params.title,
    category,
    tags: params.tags ?? [],
    createdAt: existingIdx >= 0 ? manifest.entries[existingIdx].createdAt : now,
    updatedAt: now,
    createdBy: ctx.agent,
    summary: params.content.slice(0, 200),
  }

  if (existingIdx >= 0) {
    manifest.entries[existingIdx] = entry
  } else {
    manifest.entries.push(entry)
  }

  await writeManifest(manifest)

  return {
    title: `Saved: ${relativePath}`,
    output: `Knowledge entry saved to .context/${relativePath}\nCategory: ${category}\nTags: ${(params.tags ?? []).join(", ") || "none"}`,
    metadata: { path: relativePath, operation: "save" },
  }
}

async function handleSearch(params: { query?: string; category?: string }) {
  if (!params.query) {
    return { title: "Error", output: "query is required for search operation", metadata: {} }
  }

  const manifest = await readManifest()
  const queryLower = params.query.toLowerCase()

  // Search manifest metadata first
  const metadataMatches = manifest.entries.filter((entry) => {
    if (params.category && entry.category !== params.category) return false
    return (
      entry.title.toLowerCase().includes(queryLower) ||
      entry.tags.some((t) => t.toLowerCase().includes(queryLower)) ||
      entry.category.toLowerCase().includes(queryLower) ||
      (entry.summary?.toLowerCase().includes(queryLower) ?? false)
    )
  })

  // Also do full-text search on files
  const contentMatches: ManifestEntry[] = []
  for (const entry of manifest.entries) {
    if (metadataMatches.includes(entry)) continue
    if (params.category && entry.category !== params.category) continue
    try {
      const fullPath = path.join(contextDir(), entry.path)
      const content = await Bun.file(fullPath).text()
      if (content.toLowerCase().includes(queryLower)) {
        contentMatches.push(entry)
      }
    } catch {
      // File may have been deleted outside the tool
    }
  }

  const allMatches = [...metadataMatches, ...contentMatches]

  if (allMatches.length === 0) {
    return {
      title: "No results",
      output: `No knowledge entries found matching "${params.query}"`,
      metadata: { matches: 0 },
    }
  }

  const lines = allMatches.map(
    (e) =>
      `- **${e.title}** (.context/${e.path})\n  Category: ${e.category} | Tags: ${e.tags.join(", ") || "none"} | Updated: ${new Date(e.updatedAt).toISOString().split("T")[0]}`,
  )

  return {
    title: `${allMatches.length} results`,
    output: `Found ${allMatches.length} entries matching "${params.query}":\n\n${lines.join("\n")}`,
    metadata: { matches: allMatches.length },
  }
}

async function handleList(params: { category?: string }) {
  const manifest = await readManifest()
  let entries = manifest.entries

  if (params.category) {
    entries = entries.filter((e) => e.category === params.category)
  }

  if (entries.length === 0) {
    const suffix = params.category ? ` in category "${params.category}"` : ""
    return {
      title: "Empty",
      output: `No knowledge entries found${suffix}. Use the save operation to add entries.`,
      metadata: { count: 0 },
    }
  }

  // Group by category
  const grouped = new Map<string, ManifestEntry[]>()
  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  const sections: string[] = []
  for (const [category, items] of grouped) {
    const lines = items
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(
        (e) =>
          `  - ${e.title} (${e.tags.join(", ") || "no tags"}) — ${new Date(e.updatedAt).toISOString().split("T")[0]}`,
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

  // Normalize: strip leading .context/ if user included it
  const cleanPath = params.path.replace(/^\.context\//, "")
  const fullPath = path.join(contextDir(), cleanPath)

  try {
    const content = await Bun.file(fullPath).text()
    return {
      title: `Read: ${cleanPath}`,
      output: content,
      metadata: { path: cleanPath, operation: "read" },
    }
  } catch {
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

  const cleanPath = params.path.replace(/^\.context\//, "")
  const fullPath = path.join(contextDir(), cleanPath)

  try {
    await fs.unlink(fullPath)
  } catch {
    return {
      title: "Not found",
      output: `No knowledge entry found at .context/${cleanPath}`,
      metadata: { path: cleanPath },
    }
  }

  // Update manifest
  const manifest = await readManifest()
  manifest.entries = manifest.entries.filter((e) => e.path !== cleanPath)
  await writeManifest(manifest)

  return {
    title: `Deleted: ${cleanPath}`,
    output: `Knowledge entry removed from .context/${cleanPath}`,
    metadata: { path: cleanPath, operation: "delete" },
  }
}
