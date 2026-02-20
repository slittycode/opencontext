import { expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"

const REPO_ROOT = path.resolve(import.meta.dir, "../../../..")
const DOC_FILES = [
  path.join(REPO_ROOT, "README.md"),
  path.join(REPO_ROOT, "VISION.md"),
  path.join(REPO_ROOT, "packages/web/src/content/docs/agents.mdx"),
  path.join(REPO_ROOT, "packages/web/src/content/docs/config.mdx"),
]

const RETIRED_IDS = [
  "research",
  "deep-researcher",
  "socratic",
  "tutor",
  "educator",
  "brainstorm",
  "cv-review",
  "code-expert",
]

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

test("retired agent IDs do not appear in user-facing docs", async () => {
  const findings: string[] = []

  for (const file of DOC_FILES) {
    const content = await fs.readFile(file, "utf8")
    const lines = content.split(/\r?\n/)

    for (const id of RETIRED_IDS) {
      const pattern = new RegExp(`(\\\`${escapeRegExp(id)}\\\`|\"${escapeRegExp(id)}\"|'${escapeRegExp(id)}')`)
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          findings.push(`${path.relative(REPO_ROOT, file)}:${index + 1}: ${line.trim()}`)
        }
      })
    }
  }

  expect(findings).toEqual([])
})
