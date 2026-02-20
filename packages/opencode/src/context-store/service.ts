import path from "path"
import fs from "fs/promises"
import z from "zod"
import { Instance } from "@/project/instance"

export const ContextManifestEntry = z.object({
  path: z.string(),
  title: z.string(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  createdBy: z.string().optional(),
  summary: z.string().optional(),
})
export type ContextManifestEntry = z.infer<typeof ContextManifestEntry>

export const ContextManifest = z.object({
  version: z.literal(1),
  entries: z.array(ContextManifestEntry),
})
export type ContextManifest = z.infer<typeof ContextManifest>

export function contextDir(directory = Instance.directory): string {
  return path.join(directory, ".context")
}

export function contextManifestPath(directory = Instance.directory): string {
  return path.join(contextDir(directory), "manifest.json")
}

export async function readContextManifest(directory = Instance.directory): Promise<ContextManifest> {
  try {
    const raw = await Bun.file(contextManifestPath(directory)).text()
    return ContextManifest.parse(JSON.parse(raw))
  } catch {
    return { version: 1, entries: [] }
  }
}

export async function writeContextManifest(manifest: ContextManifest, directory = Instance.directory): Promise<void> {
  await fs.mkdir(contextDir(directory), { recursive: true })
  await Bun.write(contextManifestPath(directory), JSON.stringify(manifest, null, 2))
}

export function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function saveContextEntry(input: {
  title: string
  content: string
  category?: string
  tags?: string[]
  createdBy?: string
  directory?: string
}) {
  const directory = input.directory ?? Instance.directory
  const category = input.category ?? "general"
  const filename = toKebabCase(input.title) + ".md"
  const relativePath = path.join(category, filename)
  const fullPath = path.join(contextDir(directory), relativePath)

  await fs.mkdir(path.dirname(fullPath), { recursive: true })

  const now = Date.now()
  const frontmatter = [
    "---",
    `title: \"${input.title}\"`,
    `category: \"${category}\"`,
    `created: ${new Date(now).toISOString()}`,
    `updated: ${new Date(now).toISOString()}`,
    ...(input.tags?.length ? [`tags: [${input.tags.map((t) => `\"${t}\"`).join(", ")}]`] : []),
    ...(input.createdBy ? [`agent: \"${input.createdBy}\"`] : []),
    "---",
    "",
  ].join("\n")

  await Bun.write(fullPath, frontmatter + input.content)

  const manifest = await readContextManifest(directory)
  const existingIdx = manifest.entries.findIndex((entry) => entry.path === relativePath)
  const entry: ContextManifestEntry = {
    path: relativePath,
    title: input.title,
    category,
    tags: input.tags ?? [],
    createdAt: existingIdx >= 0 ? manifest.entries[existingIdx].createdAt : now,
    updatedAt: now,
    createdBy: input.createdBy,
    summary: input.content.slice(0, 200),
  }

  if (existingIdx >= 0) manifest.entries[existingIdx] = entry
  else manifest.entries.push(entry)

  await writeContextManifest(manifest, directory)
  return entry
}

export async function listContextEntries(input?: { category?: string; directory?: string }) {
  const directory = input?.directory ?? Instance.directory
  const manifest = await readContextManifest(directory)
  if (!input?.category) return manifest.entries
  return manifest.entries.filter((entry) => entry.category === input.category)
}

export async function searchContextEntries(input: { query: string; category?: string; directory?: string }) {
  const directory = input.directory ?? Instance.directory
  const manifest = await readContextManifest(directory)
  const query = input.query.toLowerCase()

  const metadataMatches = manifest.entries.filter((entry) => {
    if (input.category && entry.category !== input.category) return false
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      entry.category.toLowerCase().includes(query) ||
      (entry.summary?.toLowerCase().includes(query) ?? false)
    )
  })

  const contentMatches: ContextManifestEntry[] = []
  for (const entry of manifest.entries) {
    if (metadataMatches.includes(entry)) continue
    if (input.category && entry.category !== input.category) continue
    try {
      const fullPath = path.join(contextDir(directory), entry.path)
      const content = await Bun.file(fullPath).text()
      if (content.toLowerCase().includes(query)) contentMatches.push(entry)
    } catch {
      // ignore dangling entries
    }
  }

  return [...metadataMatches, ...contentMatches]
}

export async function readContextEntry(input: { entryPath: string; directory?: string }) {
  const directory = input.directory ?? Instance.directory
  const cleanPath = input.entryPath.replace(/^\.context\//, "")
  const fullPath = path.join(contextDir(directory), cleanPath)

  const content = await Bun.file(fullPath).text()
  return {
    path: cleanPath,
    content,
  }
}

export async function deleteContextEntry(input: { entryPath: string; directory?: string }) {
  const directory = input.directory ?? Instance.directory
  const cleanPath = input.entryPath.replace(/^\.context\//, "")
  const fullPath = path.join(contextDir(directory), cleanPath)

  await fs.unlink(fullPath)
  const manifest = await readContextManifest(directory)
  manifest.entries = manifest.entries.filter((entry) => entry.path !== cleanPath)
  await writeContextManifest(manifest, directory)
  return cleanPath
}
