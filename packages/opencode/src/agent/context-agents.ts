import type { Agent } from "./agent"
import type { PermissionNext } from "@/permission/next"
import { AGENT_PROFILE_MANIFEST, type AgentProfile } from "./agent-profiles"
import { legacyAgentAliasEntries } from "./legacy-agents"

import PROMPT_RESEARCHER from "./prompt/researcher.txt"
import PROMPT_TEACHER from "./prompt/teacher.txt"
import PROMPT_IDEATOR from "./prompt/ideator.txt"
import PROMPT_CAREER from "./prompt/career.txt"
import PROMPT_CODEEXPERT from "./prompt/code-expert.txt"

type AgentFactory = (
  defaults: PermissionNext.Rule[],
  user: PermissionNext.Rule[],
  merge: (...rulesets: PermissionNext.Rule[][]) => PermissionNext.Rule[],
  fromConfig: (config: Record<string, any>) => PermissionNext.Rule[],
) => Record<string, Agent.Info>

const PROMPTS: Record<AgentProfile["prompt"], string> = {
  researcher: PROMPT_RESEARCHER,
  teacher: PROMPT_TEACHER,
  ideator: PROMPT_IDEATOR,
  career: PROMPT_CAREER,
  codeexpert: PROMPT_CODEEXPERT,
}

const LEGACY_ALIASES_BY_CANONICAL = legacyAgentAliasEntries().reduce<Record<string, string[]>>((acc, [legacy, to]) => {
  const current = acc[to] ?? []
  current.push(legacy)
  acc[to] = current
  return acc
}, {})

export const contextAgents: AgentFactory = (defaults, user, merge, fromConfig) => {
  const result: Record<string, Agent.Info> = {}

  for (const profile of Object.values(AGENT_PROFILE_MANIFEST)) {
    result[profile.name] = {
      name: profile.name,
      description: profile.description,
      permission: merge(defaults, fromConfig(profile.permission), user),
      prompt: PROMPTS[profile.prompt],
      temperature: profile.temperature,
      options: {
        profile: {
          category: profile.category,
          risk: profile.risk,
          modes: profile.modes,
          defaultMode: profile.defaultMode,
          capabilities: profile.capabilities,
          bestFor: profile.bestFor,
          handoffs: profile.handoffs,
          legacyAliases: LEGACY_ALIASES_BY_CANONICAL[profile.name] ?? [],
        },
      },
      mode: "primary",
      native: true,
      color: profile.color,
    }
  }

  return result
}
