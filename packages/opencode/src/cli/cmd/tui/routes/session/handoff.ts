export const HANDOFF_KEYWORDS: Record<string, string[]> = {
  researcher: ["research", "sources", "evidence", "verify", "compare"],
  teacher: ["explain", "learn", "understand", "teach", "walkthrough"],
  ideator: ["ideas", "brainstorm", "creative", "options", "concept"],
  career: ["career", "resume", "cv", "interview", "job"],
  codeexpert: ["implement", "code", "debug", "refactor", "build"],
}

export const HANDOFF_SEEDS: Record<string, string> = {
  researcher: "Continue with a research pass: gather primary sources, compare evidence quality, and summarize findings.",
  teacher: "Reframe the latest output as a learning walkthrough with checkpoints and clarifying questions.",
  ideator: "Generate 6-10 strategic alternatives based on the latest context and evaluate trade-offs.",
  career: "Translate the latest context into career-focused guidance and actionable next steps.",
  codeexpert: "Turn the latest context into an implementation plan with concrete code-level actions.",
}

export function recommendHandoffs(input: {
  activeAgent: string
  handoffs: string[]
  visiblePrimary: Set<string>
  lastAssistantText: string
  max?: number
}) {
  const max = input.max ?? 2
  const normalizedText = input.lastAssistantText.toLowerCase()
  const candidates = input.handoffs.filter(
    (target) => target !== input.activeAgent && input.visiblePrimary.has(target),
  )

  const suggestions: string[] = []
  for (const target of candidates) {
    if (suggestions.includes(target)) continue
    const keywords = HANDOFF_KEYWORDS[target] ?? []
    if (!keywords.length || keywords.some((keyword) => normalizedText.includes(keyword))) {
      suggestions.push(target)
    }
    if (suggestions.length >= max) break
  }

  return suggestions
}
