/**
 * OpenContext-specific agents.
 *
 * This module defines agents that extend the upstream OpenCode agent set.
 * Keeping them separate from the upstream agent definitions in agent.ts
 * ensures clean merges when pulling upstream updates.
 *
 * Five comprehensive agents, each a complete "world unto itself":
 *   - researcher: Research, analysis, and knowledge synthesis
 *   - teacher: Adaptive education and concept building
 *   - ideator: Creative ideation, brainstorming, and evaluation
 *   - career: Career development, professional documents, interview prep
 *   - codeexpert: Code understanding, writing, and improvement
 */

import type { Agent } from "./agent"
import type { PermissionNext } from "@/permission/next"

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

/**
 * Returns the OpenContext-specific agents.
 *
 * Parameters are injected from agent.ts to avoid circular dependencies
 * and to use the same permission utilities as the upstream agents.
 */
export const contextAgents: AgentFactory = (defaults, user, merge, fromConfig) => ({
  // ─── Researcher ────────────────────────────────────────────────────────
  // Merges: research + deep-researcher
  // Modes: Quick, Deep, Academic
  researcher: {
    name: "researcher",
    description: "Research specialist. Multi-source investigation, credibility evaluation, and knowledge synthesis. Modes: quick, deep, academic.",
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
    prompt: PROMPT_RESEARCHER,
    temperature: 0.2,
    options: {},
    mode: "primary",
    native: true,
    color: "#10b981",
  },

  // ─── Teacher ───────────────────────────────────────────────────────────
  // Merges: socratic + tutor + educator
  // Modes: Explain, Socratic, Guided
  teacher: {
    name: "teacher",
    description: "Adaptive educator. Explains concepts, guides discovery through questions, and teaches step-by-step. Modes: explain, socratic, guided.",
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
    prompt: PROMPT_TEACHER,
    temperature: 0.4,
    options: {},
    mode: "primary",
    native: true,
    color: "#8b5cf6",
  },

  // ─── Ideator ───────────────────────────────────────────────────────────
  // Merges: brainstorm + ideator
  // Modes: Brainstorm, Explore, Evaluate, Combine
  ideator: {
    name: "ideator",
    description: "Creative ideation agent. Brainstorming, speculative exploration, structured evaluation, and idea combination. Modes: brainstorm, explore, evaluate, combine.",
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
    temperature: 0.8,
    options: {},
    mode: "primary",
    native: true,
    color: "#a855f7",
  },

  // ─── Career ────────────────────────────────────────────────────────────
  // Replaces: cv-review (broadened scope)
  // Modes: CV/Resume, Cover Letter, LinkedIn, Correspondence, Interview Prep, Career Strategy
  career: {
    name: "career",
    description: "Career development advisor. CV/resume review, cover letters, LinkedIn profiles, professional correspondence, interview prep, and career strategy.",
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
    prompt: PROMPT_CAREER,
    temperature: 0.3,
    options: {},
    mode: "primary",
    native: true,
    color: "#f59e0b",
  },

  // ─── Code Expert ───────────────────────────────────────────────────────
  // Renamed from: code-expert (no hyphen)
  // Modes: explain, write, improve
  codeexpert: {
    name: "codeexpert",
    description: "Code understanding, writing, and improvement. Modes: explain:[code], write:[code], improve:[code]. Maintains codebase knowledge.",
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
    prompt: PROMPT_CODEEXPERT,
    temperature: 0.2,
    options: {},
    mode: "primary",
    native: true,
    color: "#f97316",
  },
})
