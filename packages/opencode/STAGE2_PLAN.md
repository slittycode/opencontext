# Stage 2: Career Agent Memory Architecture

## Overview

This document outlines the implementation plan for adding persistent, long-term memory to career agents (career-strategist, job-hunter, interview-coach).

**Prerequisites:** Phase 1 (career agent definitions and prompts) must be complete.

**Storage Location:** `~/.local/share/opencontext/career/`

---

## Architecture

### Memory Tiering

| Tier               | Trigger for Auto-Recall              | Retention                | Pruning                               |
| ------------------ | ------------------------------------ | ------------------------ | ------------------------------------- |
| **Core Profile**   | Always (on every career agent start) | Forever                  | Manual only                           |
| **Current Status** | Always                               | Until resolved + 30 days | Auto                                  |
| **Recent Context** | Within session                       | 7 days                   | Auto                                  |
| **Archive**        | On explicit query only               | 1 year                   | Generate summary at 6mo, prune at 1yr |

### Data Transformation Rules

| Condition                   | Action                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Input > 500 chars           | Extract bullet points if user provided; otherwise auto-summarize to 1-2 paragraphs |
| User provides bullet points | Save as-is                                                                         |
| Archive at 6 months         | Generate 1-2 sentence summary + key context                                        |
| Archive at 1 year           | Delete full content, keep summary only                                             |

### Directory Structure

```
~/.local/share/opencontext/career/
├── profile.json           # Core Profile (always loaded)
├── status.json           # Current Status (always loaded)
├── recent/               # Recent Context (last 7 days)
│   └── {session-uuid}.json
├── archive/              # Archive (1 year TTL)
│   ├── applications/
│   └── ideas/
└── config.json           # Retention settings
```

---

## Implementation Steps

### Step 2.1: Create CareerMemory Module

**File:** `packages/opencode/src/memory/career.ts`

```typescript
import z from "zod"
import path from "path"
import fs from "fs/promises"
import { Global } from "@/global"

export namespace CareerMemory {
  // Zod schemas for each tier
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

  // Storage paths
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

  // CRUD operations
  export async function readProfile() {
    const file = Bun.file(profilePath())
    if (!(await file.exists())) return CoreProfile.parse({})
    return CoreProfile.parse(await file.json())
  }

  export async function writeProfile(data: z.infer<typeof CoreProfile>) {
    await fs.mkdir(dir(), { recursive: true })
    await Bun.write(profilePath(), JSON.stringify(data, null, 2))
  }

  export async function readStatus() {
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

  export async function writeStatus(data: z.infer<typeof CurrentStatus>) {
    await fs.mkdir(dir(), { recursive: true })
    await Bun.write(statusPath(), JSON.stringify(data, null, 2))
  }

  // Additional CRUD for recent and archive...
}
```

---

### Step 2.2: Build Storage Directory Structure

**In code (automatic initialization):**

```typescript
// Add to packages/opencode/src/memory/career.ts
export async function initialize() {
  await fs.mkdir(dir(), { recursive: true })
  await fs.mkdir(recentDir(), { recursive: true })
  await fs.mkdir(path.join(archiveDir(), "applications"), { recursive: true })
  await fs.mkdir(path.join(archiveDir(), "ideas"), { recursive: true })

  // Create empty profile.json if not exists
  if (!(await Bun.file(profilePath()).exists())) {
    await writeProfile({})
  }

  // Create empty status.json if not exists
  if (!(await Bun.file(statusPath()).exists())) {
    await writeStatus({ stage: "researching", activeApplications: [], recentOutcomes: [], updatedAt: Date.now() })
  }
}
```

---

### Step 2.3: Implement Relevance Scoring

**File:** `packages/opencode/src/memory/career.ts`

```typescript
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

    // 1. Profile match (40 points max)
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

    // 2. Status weighting (30 points max)
    const statusWeight = {
      interviewing: 30,
      applied: 20,
      negotiating: 25,
      researching: 10,
    }
    score += statusWeight[status.stage] || 0

    // 3. Time decay (30 points max, exponential decay)
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
```

---

### Step 2.4: Memory Injection Utility

**File:** `packages/opencode/src/memory/career.ts`

```typescript
export async function buildMemoryContext(topN: number = 5, config: { timeDecayFactor: number }): Promise<string> {
  const profile = await readProfile()
  const status = await readStatus()
  const recent = await readRecentContext(7)
  const archive = await readArchive()

  // Rank archive by relevance
  const ranked = Scoring.rankEntries(archive, profile, status, config)
  const topArchive = ranked.slice(0, topN)

  const sections = []

  // Core Profile
  if (profile.name || profile.targetRoles.length > 0) {
    sections.push(`## Core Profile\n${JSON.stringify(profile, null, 2)}`)
  }

  // Current Status
  sections.push(`## Current Status\n${JSON.stringify(status, null, 2)}`)

  // Recent Context
  if (recent.length > 0) {
    sections.push(
      `## Recent Context\n${recent.map((r) => `- [${r.agentName}] ${r.content.slice(0, 100)}...`).join("\n")}`,
    )
  }

  // Top Archive Entries
  if (topArchive.length > 0) {
    sections.push(
      `## Relevant Archive\n${topArchive.map((s) => `- **Score ${s.score}**: ${s.entry.summary || s.entry.content.slice(0, 100)}`).join("\n")}`,
    )
  }

  return sections.join("\n\n")
}
```

---

### Step 2.5: Update Career Agent Prompts

**Files to modify:**

- `packages/opencode/src/agent/prompt/career-strategist.txt`
- `packages/opencode/src/agent/prompt/job-hunter.txt`
- `packages/opencode/src/agent/prompt/interview-coach.txt`

**Add at the top of each:**

```
# Career Memory Context

The following memory is automatically loaded from the user's career profile:

{{CAREER_MEMORY}}

Use this context to personalize your responses and maintain continuity across sessions.
```

**Code to inject (in session/agent initialization):**

```typescript
// Where agent prompts are loaded
import { CareerMemory } from "@/memory/career"

const memoryContext = await CareerMemory.buildMemoryContext(5, { timeDecayFactor: 0.1 })
const finalPrompt = agentPrompt.replace("{{CAREER_MEMORY}}", memoryContext)
```

---

### Step 2.6: Grant Mutual Task Permissions

**Status:** Already done. All career agents have `task: "allow"` in their permissions.

---

### Step 2.7: Create career-memory Tool

**File:** `packages/opencode/src/tool/career-memory.ts`

```typescript
import z from "zod"
import { Tool } from "./tool"
import { CareerMemory } from "@/memory/career"
import DESCRIPTION from "./career-memory.txt"

export const CareerMemoryTool = Tool.define("career_memory", {
  description: DESCRIPTION,
  parameters: z.object({
    operation: z.enum(["save", "recall", "search", "pin", "forget"]),
    tier: z.enum(["profile", "status", "recent", "archive"]).optional(),
    content: z.string().optional(),
    query: z.string().optional(),
    id: z.string().optional(),
  }),
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
    }
  },
})

async function handleSave(params, ctx) {
  if (params.content && params.content.length > 500) {
    const bullets = extractBullets(params.content)
    params.content = bullets.length > 0 ? bullets.join("\n") : summarize(params.content)
  }
  // ... save logic
}

function extractBullets(text: string): string[] {
  const lines = text.split("\n")
  return lines.filter((line) => line.trim().match(/^[-*•]\s/))
}

function summarize(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || []
  return sentences.slice(0, 2).join(" ")
}
```

**Description file:** `packages/opencode/src/tool/career-memory.txt`

```
Career memory management tool for career agents.

Operations:
- save: Save information to career memory
- recall: Load all relevant memory for current context
- search: Search memory by query
- pin: Pin an item to Core Profile (always loaded)
- forget: Remove an item from memory
```

**Register tool:** In `packages/opencode/src/tool/registry.ts`

```typescript
// Step 1: Import at top
import { CareerMemoryTool } from "./career-memory"

// Step 2: Add to all() array after ContextStoreTool
async function all(): Promise<Tool.Info[]> {
  return [
    // ... other tools
    ContextStoreTool,
    CareerMemoryTool,
    // ... more tools
  ]
}
```

**Add permission:** In `packages/opencode/src/agent/context-agents.ts`

```typescript
"career-strategist": {
  permission: merge(
    defaults,
    fromConfig({
      // ... existing permissions
      career_memory: "allow",
    }),
  ),
}
// Repeat for job-hunter and interview-coach
```

---

### Step 2.8: Add Config Schema

**File:** `packages/opencode/src/config/config.ts` (around line 850+)

```typescript
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
    .default({}),
  timeDecayFactor: z.number().default(0.1),
  maxCoreProfileChars: z.number().default(2000),
  maxStatusChars: z.number().default(1000),
})
```

---

### Step 2.9: Implement Auto-Pruning

**File:** `packages/opencode/src/memory/career.ts`

```typescript
export async function pruneStaleData(config: z.infer<typeof CareerMemoryConfig>) {
  const now = Date.now()
  const archive = await readArchive()

  for (const entry of archive) {
    const ageInDays = (now - entry.createdAt) / (1000 * 60 * 60 * 24)

    // Summarize at 6 months
    if (ageInDays >= config.tiering.archive.summarizeAtDay && !entry.summary) {
      entry.summary = summarize(entry.content)
      entry.content = ""
      await updateArchiveEntry(entry)
    }

    // Delete at 1 year
    if (ageInDays >= config.tiering.archive.retentionDays) {
      await deleteArchiveEntry(entry.id)
    }
  }

  // Prune recent context
  const recent = await readRecentContext(999)
  for (const r of recent) {
    const ageInDays = (now - r.timestamp) / (1000 * 60 * 60 * 24)
    if (ageInDays > config.tiering.recent.retentionDays) {
      await deleteRecentContext(r.sessionId)
    }
  }
}
```

**Call on agent startup:**

```typescript
// In career agent initialization
if (["career-strategist", "job-hunter", "interview-coach"].includes(agentName)) {
  await CareerMemory.initialize()
  await CareerMemory.pruneStaleData(config.career?.memory || defaultConfig)
}
```

---

### Step 2.10: Verification Tests

**File:** `packages/opencode/test/memory/career.test.ts`

```typescript
import { describe, test, expect } from "bun:test"
import { CareerMemory } from "@/memory/career"

describe("CareerMemory", () => {
  test("initialize creates directory structure", async () => {
    await CareerMemory.initialize()
    const dir = CareerMemory.dir()
    expect(await Bun.file(dir).exists()).toBe(true)
  })

  test("relevance scoring prioritizes recent + status match", () => {
    const entry = {
      id: "1",
      category: "applications",
      content: "Applied to Google for Senior Engineer role",
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    }
    const profile = { targetRoles: ["Senior Engineer"], skills: ["TypeScript"] }
    const status = { stage: "interviewing" }

    const score = CareerMemory.Scoring.calculateRelevance(entry, profile, status, { timeDecayFactor: 0.1 })
    expect(score).toBeGreaterThan(50)
  })

  test("pruneStaleData removes 1-year-old entries", async () => {
    // Test implementation...
  })
})
```

**Run tests:**

```bash
bun --cwd packages/opencode test test/memory/career.test.ts
```

---

## Implementation Checklist

| Step | Task                | Files to Create/Modify                                                                                           |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 2.1  | CareerMemory module | `src/memory/career.ts`                                                                                           |
| 2.2  | Storage structure   | `src/memory/career.ts` (add initialize())                                                                        |
| 2.3  | Relevance scoring   | `src/memory/career.ts` (add Scoring namespace)                                                                   |
| 2.4  | Memory injection    | `src/memory/career.ts` (add buildMemoryContext())                                                                |
| 2.5  | Update prompts      | `src/agent/prompt/career-strategist.txt`, `job-hunter.txt`, `interview-coach.txt`                                |
| 2.6  | Task permissions    | ✅ Already done                                                                                                  |
| 2.7  | career-memory tool  | `src/tool/career-memory.ts`, `src/tool/career-memory.txt`, `src/tool/registry.ts`, `src/agent/context-agents.ts` |
| 2.8  | Config schema       | `src/config/config.ts`                                                                                           |
| 2.9  | Auto-pruning        | `src/memory/career.ts` (add pruneStaleData())                                                                    |
| 2.10 | Tests               | `test/memory/career.test.ts`                                                                                     |

---

## Verification Commands

```bash
# Typecheck
bun run typecheck

# Run tests
bun --cwd packages/opencode test

# Run career memory tests specifically
bun --cwd packages/opencode test test/memory/career.test.ts
```

---

## User Configuration

Users can configure memory behavior in `opencontext.json`:

```json
{
  "agents": {
    "career": {
      "memory": {
        "enabled": true,
        "tiering": {
          "core": { "retention": -1 },
          "status": { "retentionDays": 30 },
          "recent": { "retentionDays": 7 },
          "archive": { "retentionDays": 365, "summarizeAtDay": 180 }
        },
        "timeDecayFactor": 0.1,
        "maxCoreProfileChars": 2000,
        "maxStatusChars": 1000
      }
    }
  }
}
```

---

## Security

- All data stored locally at `~/.local/share/opencontext/career/`
- Directory permissions: `700` (owner read/write only)
- No cloud sync by default

---

## Cross-Agent Memory Sharing

| Agent             | Can Read | Can Write                         |
| ----------------- | -------- | --------------------------------- |
| career-strategist | All      | Ideas, profile updates            |
| job-hunter        | All      | Applications, status              |
| interview-coach   | All      | Coaching notes, session summaries |

All career agents can invoke each other as sub-agents via the `task` tool.
