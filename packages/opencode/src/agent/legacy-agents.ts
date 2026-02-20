export const LEGACY_AGENT_ALIASES = {
  research: "researcher",
  "deep-researcher": "researcher",
  socratic: "teacher",
  tutor: "teacher",
  educator: "teacher",
  brainstorm: "ideator",
  "cv-review": "career",
  "code-expert": "codeexpert",
} as const

export type LegacyAgentName = keyof typeof LEGACY_AGENT_ALIASES

export const LEGACY_AGENT_REMOVAL_TARGET = "next minor release after this compatibility bridge"

export function isLegacyAgentName(name: string): name is LegacyAgentName {
  return name in LEGACY_AGENT_ALIASES
}

export function canonicalizeAgentName(name: string): {
  input: string
  canonical: string
  aliased: boolean
  message?: string
} {
  const canonical = LEGACY_AGENT_ALIASES[name as LegacyAgentName] ?? name
  const aliased = canonical !== name
  if (!aliased) return { input: name, canonical, aliased }

  return {
    input: name,
    canonical,
    aliased,
    message: `Agent "${name}" is deprecated and now maps to "${canonical}". Compatibility alias will be removed in the ${LEGACY_AGENT_REMOVAL_TARGET}.`,
  }
}

export function legacyAgentAliasEntries() {
  return Object.entries(LEGACY_AGENT_ALIASES) as [LegacyAgentName, string][]
}
