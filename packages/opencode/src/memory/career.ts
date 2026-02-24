import z from "zod"
import path from "path"
import fs from "fs/promises"
import { Global } from "@/global"
import { randomUUID } from "crypto"

export namespace CareerMemory {
  export const CoreProfile = z.object({
    name: z.string().optional(),
    targetRoles: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    location: z.string().optional(),
    salaryRange: z.object({ min: z.number(), max: z.number() }).optional(),
    cvSummary: z.string().optional(),
    pinnedItems: z.array(z.string()).default([]),
  })

  export const CurrentStatus = z.object({
    stage: z.enum(["researching", "applied", "interviewing", "negotiating"]),
    activeApplications: z.array(z.string()).default([]),
    recentOutcomes: z
      .array(
        z.object({
          company: z.string(),
          outcome: z.string(),
          date: z.number(),
        }),
      )
      .default([]),
    updatedAt: z.number(),
  })

  export const RecentContext = z.object({
    sessionId: z.string(),
    content: z.string(),
    timestamp: z.number(),
    agentName: z.string(),
  })

  export const ArchiveEntry = z.object({
    id: z.string(),
    category: z.enum(["applications", "ideas"]),
    content: z.string(),
    summary: z.string().optional(),
    createdAt: z.number(),
    archivedAt: z.number().optional(),
  })

  export function dir() {
    return path.join(Global.Path.data, "career")
  }

  export function profilePath() {
    return path.join(dir(), "profile.json")
  }

  export function statusPath() {
    return path.join(dir(), "status.json")
  }

  export function recentDir() {
    return path.join(dir(), "recent")
  }

  export function archiveDir() {
    return path.join(dir(), "archive")
  }

  export async function readProfile(): Promise<z.infer<typeof CoreProfile>> {
    const file = Bun.file(profilePath())
    if (!(await file.exists())) return CoreProfile.parse({ targetRoles: [], skills: [], pinnedItems: [] })
    return CoreProfile.parse(await file.json())
  }

  export async function writeProfile(data: z.infer<typeof CoreProfile>): Promise<void> {
    await fs.mkdir(dir(), { recursive: true })
    await Bun.write(profilePath(), JSON.stringify(data, null, 2))
  }

  export async function readStatus(): Promise<z.infer<typeof CurrentStatus>> {
    const file = Bun.file(statusPath())
    if (!(await file.exists())) {
      return CurrentStatus.parse({
        stage: "researching",
        activeApplications: [],
        recentOutcomes: [],
        updatedAt: Date.now(),
      })
    }
    return CurrentStatus.parse(await file.json())
  }

  export async function writeStatus(data: z.infer<typeof CurrentStatus>): Promise<void> {
    await fs.mkdir(dir(), { recursive: true })
    await Bun.write(statusPath(), JSON.stringify(data, null, 2))
  }

  export async function initialize(): Promise<void> {
    await fs.mkdir(dir(), { recursive: true })
    await fs.mkdir(recentDir(), { recursive: true })
    await fs.mkdir(path.join(archiveDir(), "applications"), { recursive: true })
    await fs.mkdir(path.join(archiveDir(), "ideas"), { recursive: true })

    if (!(await Bun.file(profilePath()).exists())) {
      await writeProfile({ targetRoles: [], skills: [], pinnedItems: [] })
    }

    if (!(await Bun.file(statusPath()).exists())) {
      await writeStatus({
        stage: "researching",
        activeApplications: [],
        recentOutcomes: [],
        updatedAt: Date.now(),
      })
    }
  }

  export async function readRecentContext(days: number): Promise<z.infer<typeof RecentContext>[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    try {
      const dir = await fs.readdir(recentDir())
      const results: z.infer<typeof RecentContext>[] = []

      for (const file of dir) {
        if (!file.endsWith(".json")) continue
        const content = await Bun.file(path.join(recentDir(), file)).json()
        if (content.timestamp > cutoff) {
          results.push(RecentContext.parse(content))
        }
      }

      return results.sort((a, b) => b.timestamp - a.timestamp)
    } catch {
      return []
    }
  }

  export async function writeRecentContext(data: z.infer<typeof RecentContext>): Promise<void> {
    await fs.mkdir(recentDir(), { recursive: true })
    await Bun.write(path.join(recentDir(), `${data.sessionId}.json`), JSON.stringify(data, null, 2))
  }

  export async function deleteRecentContext(sessionId: string): Promise<void> {
    try {
      await fs.unlink(path.join(recentDir(), `${sessionId}.json`))
    } catch {
      // Ignore if doesn't exist
    }
  }

  export async function readArchive(): Promise<z.infer<typeof ArchiveEntry>[]> {
    try {
      const appsDir = path.join(archiveDir(), "applications")
      const ideasDir = path.join(archiveDir(), "ideas")
      const results: z.infer<typeof ArchiveEntry>[] = []

      for (const dir of [appsDir, ideasDir]) {
        try {
          const files = await fs.readdir(dir)
          for (const file of files) {
            if (!file.endsWith(".json")) continue
            const content = await Bun.file(path.join(dir, file)).json()
            results.push(ArchiveEntry.parse(content))
          }
        } catch {
          // Directory doesn't exist yet
        }
      }

      return results.sort((a, b) => b.createdAt - a.createdAt)
    } catch {
      return []
    }
  }

  export async function writeArchiveEntry(data: z.infer<typeof ArchiveEntry>): Promise<void> {
    const categoryDir = path.join(archiveDir(), data.category)
    await fs.mkdir(categoryDir, { recursive: true })
    await Bun.write(path.join(categoryDir, `${data.id}.json`), JSON.stringify(data, null, 2))
  }

  export async function updateArchiveEntry(data: z.infer<typeof ArchiveEntry>): Promise<void> {
    await writeArchiveEntry(data)
  }

  export async function deleteArchiveEntry(id: string): Promise<void> {
    for (const category of ["applications", "ideas"]) {
      try {
        await fs.unlink(path.join(archiveDir(), category, `${id}.json`))
      } catch {
        // Ignore if doesn't exist
      }
    }
  }

  export function generateId(): string {
    return randomUUID()
  }

  export namespace Scoring {
    export interface ScoredEntry {
      entry: z.infer<typeof ArchiveEntry>
      score: number
    }

    export function calculateRelevance(
      entry: z.infer<typeof ArchiveEntry>,
      profile: z.infer<typeof CoreProfile>,
      status: z.infer<typeof CurrentStatus>,
      config: { timeDecayFactor: number },
    ): number {
      let score = 0

      const content = entry.content.toLowerCase()
      const summary = entry.summary?.toLowerCase() || ""

      for (const role of profile.targetRoles) {
        if (content.includes(role.toLowerCase()) || summary.includes(role.toLowerCase())) {
          score += 10
        }
      }

      for (const skill of profile.skills) {
        if (content.includes(skill.toLowerCase()) || summary.includes(skill.toLowerCase())) {
          score += 5
        }
      }

      const statusWeight: Record<string, number> = {
        interviewing: 30,
        applied: 20,
        negotiating: 25,
        researching: 10,
      }
      score += statusWeight[status.stage] || 0

      const ageInDays = (Date.now() - entry.createdAt) / (1000 * 60 * 60 * 24)
      const decayScore = 30 * Math.exp(-config.timeDecayFactor * ageInDays)
      score += decayScore

      return Math.round(score)
    }

    export function rankEntries(
      entries: z.infer<typeof ArchiveEntry>[],
      profile: z.infer<typeof CoreProfile>,
      status: z.infer<typeof CurrentStatus>,
      config: { timeDecayFactor: number },
    ): ScoredEntry[] {
      return entries
        .map((entry) => ({
          entry,
          score: calculateRelevance(entry, profile, status, config),
        }))
        .sort((a, b) => b.score - a.score)
    }
  }

  function extractBullets(text: string): string[] {
    const lines = text.split("\n")
    return lines.filter((line) => line.trim().match(/^[-*•]\s/))
  }

  function summarize(text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || []
    return sentences.slice(0, 2).join(" ")
  }

  export function processContent(content: string): string {
    if (content.length <= 500) return content

    const bullets = extractBullets(content)
    if (bullets.length > 0) {
      return bullets.join("\n")
    }
    return summarize(content)
  }

  export async function buildMemoryContext(topN: number = 5, config: { timeDecayFactor: number }): Promise<string> {
    const profile = await readProfile()
    const status = await readStatus()
    const recent = await readRecentContext(7)
    const archive = await readArchive()

    const ranked = Scoring.rankEntries(archive, profile, status, config)
    const topArchive = ranked.slice(0, topN)

    const sections: string[] = []

    if (profile.name || profile.targetRoles.length > 0) {
      sections.push(`## Core Profile\n${JSON.stringify(profile, null, 2)}`)
    }

    sections.push(`## Current Status\n${JSON.stringify(status, null, 2)}`)

    if (recent.length > 0) {
      sections.push(
        `## Recent Context\n${recent.map((r) => `- [${r.agentName}] ${r.content.slice(0, 100)}...`).join("\n")}`,
      )
    }

    if (topArchive.length > 0) {
      sections.push(
        `## Relevant Archive\n${topArchive
          .map((s) => `- **Score ${s.score}**: ${s.entry.summary || s.entry.content.slice(0, 100)}`)
          .join("\n")}`,
      )
    }

    return sections.join("\n\n")
  }

  export const CareerMemoryConfig = z.object({
    enabled: z.boolean().default(true),
    tiering: z
      .object({
        core: z.object({ retention: z.number().default(-1) }),
        status: z.object({ retentionDays: z.number().default(30) }),
        recent: z.object({ retentionDays: z.number().default(7) }),
        archive: z.object({
          retentionDays: z.number().default(365),
          summarizeAtDay: z.number().default(180),
        }),
      })
      .default({
        core: { retention: -1 },
        status: { retentionDays: 30 },
        recent: { retentionDays: 7 },
        archive: { retentionDays: 365, summarizeAtDay: 180 },
      }),
    timeDecayFactor: z.number().default(0.1),
    maxCoreProfileChars: z.number().default(2000),
    maxStatusChars: z.number().default(1000),
  })

  export async function pruneStaleData(
    config: z.infer<typeof CareerMemoryConfig> = CareerMemoryConfig.parse({}),
  ): Promise<void> {
    const now = Date.now()
    const archive = await readArchive()

    for (const entry of archive) {
      const ageInDays = (now - entry.createdAt) / (1000 * 60 * 60 * 24)

      if (ageInDays >= config.tiering.archive.summarizeAtDay && !entry.summary) {
        entry.summary = summarize(entry.content)
        entry.content = ""
        entry.archivedAt = now
        await updateArchiveEntry(entry)
      }

      if (ageInDays >= config.tiering.archive.retentionDays) {
        await deleteArchiveEntry(entry.id)
      }
    }

    const recent = await readRecentContext(999)
    for (const r of recent) {
      const ageInDays = (now - r.timestamp) / (1000 * 60 * 60 * 24)
      if (ageInDays > config.tiering.recent.retentionDays) {
        await deleteRecentContext(r.sessionId)
      }
    }
  }
}
