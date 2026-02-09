/**
 * OpenContext-specific agents.
 *
 * This module defines agents that extend the upstream OpenCode agent set.
 * Keeping them separate from the upstream agent definitions in agent.ts
 * ensures clean merges when pulling upstream updates.
 */

import type { Agent } from "./agent"
import type { PermissionNext } from "@/permission/next"

import PROMPT_RESEARCH from "./prompt/research.txt"
import PROMPT_SOCRATIC from "./prompt/socratic.txt"
import PROMPT_CV_REVIEW from "./prompt/cv-review.txt"
import PROMPT_BRAINSTORM from "./prompt/brainstorm.txt"
import PROMPT_TUTOR from "./prompt/tutor.txt"
import PROMPT_EDUCATOR from "./prompt/educator.txt"
import PROMPT_IDEATOR from "./prompt/ideator.txt"
import PROMPT_DEEP_RESEARCHER from "./prompt/deep-researcher.txt"
import PROMPT_CODE_EXPERT from "./prompt/code-expert.txt"

type AgentFactory = (
  defaults: PermissionNext.Rule[],
  user: PermissionNext.Rule[],
  merge: (...rulesets: PermissionNext.Rule[][]) => PermissionNext.Rule[],
  fromConfig: (config: Record<string, any>) => PermissionNext.Rule[],
) => Record<string, Agent.Info>

/**
 * Returns the OpenContext-specific agents.
 *
 * Parameters are injected from agent.ts to avoid circular dependencies
 * and to use the same permission utilities as the upstream agents.
 */
export const contextAgents: AgentFactory = (defaults, user, merge, fromConfig) => ({
  // === Context Agents: First Wave (general-purpose knowledge roles) ===
  research: {
    name: "research",
    description: "Deep research agent. Web search, synthesis, analysis.",
    permission: merge(
      defaults,
      fromConfig({
        edit: "deny",
        write: "deny",
        bash: "deny",
        websearch: "allow",
        webfetch: "allow",
        read: "allow",
        task: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_RESEARCH,
    options: {},
    mode: "primary",
    native: true,
    color: "#10b981",
  },
  socratic: {
    name: "socratic",
    description: "Teaching through questions. Guides discovery.",
    permission: merge(
      defaults,
      fromConfig({
        "*": "deny",
        question: "allow",
        websearch: "allow",
        webfetch: "allow",
        read: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_SOCRATIC,
    options: {},
    mode: "primary",
    native: true,
    color: "#8b5cf6",
  },
  "cv-review": {
    name: "cv-review",
    description: "CV/resume analysis and improvement.",
    permission: merge(
      defaults,
      fromConfig({
        edit: "deny",
        bash: "deny",
        read: "allow",
        write: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_CV_REVIEW,
    options: {},
    mode: "primary",
    native: true,
    color: "#f59e0b",
  },
  brainstorm: {
    name: "brainstorm",
    description: "Creative ideation and concept exploration.",
    permission: merge(
      defaults,
      fromConfig({
        "*": "deny",
        websearch: "allow",
        webfetch: "allow",
        todowrite: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_BRAINSTORM,
    options: {},
    mode: "primary",
    native: true,
    color: "#ec4899",
  },
  tutor: {
    name: "tutor",
    description: "Patient explanations and learning support.",
    permission: merge(
      defaults,
      fromConfig({
        "*": "deny",
        websearch: "allow",
        webfetch: "allow",
        read: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_TUTOR,
    options: {},
    mode: "primary",
    native: true,
    color: "#06b6d4",
  },

  // === Knowledge-Developing Agents: Second Wave (deeper workflows) ===
  educator: {
    name: "educator",
    description: "Tech Educator. Explains and teaches at adaptive depth. Builds concept libraries.",
    permission: merge(
      defaults,
      fromConfig({
        read: "allow",
        write: "allow",
        edit: "deny",
        bash: "deny",
        websearch: "allow",
        webfetch: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_EDUCATOR,
    options: {},
    mode: "primary",
    native: true,
    color: "#3b82f6",
  },
  ideator: {
    name: "ideator",
    description: "Creative Ideator. Open-ended brainstorming, exploration, and speculative thinking.",
    permission: merge(
      defaults,
      fromConfig({
        read: "allow",
        write: "allow",
        edit: "deny",
        bash: "deny",
        websearch: "allow",
        webfetch: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_IDEATOR,
    options: {},
    mode: "primary",
    native: true,
    color: "#a855f7",
  },
  "deep-researcher": {
    name: "deep-researcher",
    description: "Deep Researcher. Comprehensive multi-source research with credibility evaluation.",
    permission: merge(
      defaults,
      fromConfig({
        read: "allow",
        write: "allow",
        edit: "deny",
        bash: "deny",
        websearch: "allow",
        webfetch: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_DEEP_RESEARCHER,
    options: {},
    mode: "primary",
    native: true,
    color: "#22c55e",
  },
  "code-expert": {
    name: "code-expert",
    description: "Code Expert. explain:[code], write:[code], improve:[code]. Maintains codebase knowledge.",
    permission: merge(
      defaults,
      fromConfig({
        read: "allow",
        write: "allow",
        edit: "allow",
        bash: "allow",
        websearch: "allow",
        webfetch: "allow",
        question: "allow",
        context_store: "allow",
      }),
      user,
    ),
    prompt: PROMPT_CODE_EXPERT,
    options: {},
    mode: "primary",
    native: true,
    color: "#f97316",
  },
})
