export type SpecialistAgentName = "researcher" | "teacher" | "ideator" | "career" | "codeexpert"

export type AgentModeProfile = {
  id: string
  label: string
  description: string
}

export type AgentProfile = {
  name: SpecialistAgentName
  description: string
  prompt: "researcher" | "teacher" | "ideator" | "career" | "codeexpert"
  temperature: number
  color: string
  permission: Record<string, any>
  category: "Specialist"
  risk: "low" | "medium" | "high"
  modes: AgentModeProfile[]
  defaultMode: string
  capabilities: string[]
  bestFor: string[]
  handoffs: SpecialistAgentName[]
}

export type AgentProfileMetadata = {
  category: AgentProfile["category"]
  risk: AgentProfile["risk"]
  modes: AgentProfile["modes"]
  defaultMode: AgentProfile["defaultMode"]
  capabilities: AgentProfile["capabilities"]
  bestFor: AgentProfile["bestFor"]
  handoffs: AgentProfile["handoffs"]
  legacyAliases?: string[]
}

export const AGENT_PROFILE_MANIFEST: Record<SpecialistAgentName, AgentProfile> = {
  researcher: {
    name: "researcher",
    description:
      "Research specialist. Multi-source investigation, credibility evaluation, and knowledge synthesis. Modes: quick, deep, academic.",
    prompt: "researcher",
    temperature: 0.2,
    color: "#10b981",
    permission: {
      edit: "deny",
      write: "deny",
      bash: "deny",
      websearch: "allow",
      webfetch: "allow",
      read: "allow",
      task: "allow",
      question: "allow",
      context_store: "allow",
    },
    category: "Specialist",
    risk: "low",
    modes: [
      { id: "quick", label: "Quick", description: "Fast synthesis with concise sourcing." },
      { id: "deep", label: "Deep", description: "Comprehensive, multi-pass analysis with source cross-checking." },
      { id: "academic", label: "Academic", description: "Formal research style with emphasis on primary literature." },
    ],
    defaultMode: "quick",
    capabilities: ["websearch", "webfetch", "read", "context_store"],
    bestFor: ["topic investigation", "source comparison", "structured research briefs"],
    handoffs: ["teacher", "ideator", "career", "codeexpert"],
  },
  teacher: {
    name: "teacher",
    description:
      "Adaptive educator. Explains concepts, guides discovery through questions, and teaches step-by-step. Modes: explain, socratic, guided.",
    prompt: "teacher",
    temperature: 0.4,
    color: "#8b5cf6",
    permission: {
      "*": "deny",
      websearch: "allow",
      webfetch: "allow",
      read: "allow",
      question: "allow",
      context_store: "allow",
    },
    category: "Specialist",
    risk: "low",
    modes: [
      { id: "explain", label: "Explain", description: "Progressive disclosure with concise conceptual scaffolding." },
      { id: "socratic", label: "Socratic", description: "Question-led reasoning and guided discovery." },
      { id: "guided", label: "Guided", description: "Stepwise teaching with comprehension checkpoints." },
    ],
    defaultMode: "explain",
    capabilities: ["websearch", "webfetch", "read", "question", "context_store"],
    bestFor: ["learning plans", "concept walkthroughs", "skills onboarding"],
    handoffs: ["researcher", "ideator", "career", "codeexpert"],
  },
  ideator: {
    name: "ideator",
    description:
      "Creative ideation agent. Brainstorming, speculative exploration, structured evaluation, and idea combination. Modes: brainstorm, explore, evaluate, combine.",
    prompt: "ideator",
    temperature: 0.8,
    color: "#a855f7",
    permission: {
      read: "allow",
      write: "deny",
      edit: "deny",
      bash: "deny",
      websearch: "allow",
      webfetch: "allow",
      question: "allow",
      context_store: "allow",
    },
    category: "Specialist",
    risk: "medium",
    modes: [
      { id: "brainstorm", label: "Brainstorm", description: "Divergent idea generation with minimal filtering." },
      { id: "explore", label: "Explore", description: "Scenario expansion and second-order implication mapping." },
      { id: "evaluate", label: "Evaluate", description: "Convergent analysis with explicit decision criteria." },
      { id: "combine", label: "Combine", description: "Hybrid synthesis from multiple partially formed ideas." },
    ],
    defaultMode: "brainstorm",
    capabilities: ["websearch", "webfetch", "read", "question", "context_store"],
    bestFor: ["problem framing", "concept generation", "strategy option design"],
    handoffs: ["researcher", "teacher", "career", "codeexpert"],
  },
  career: {
    name: "career",
    description:
      "Career development advisor. CV/resume review, cover letters, LinkedIn profiles, professional correspondence, interview prep, and career strategy.",
    prompt: "career",
    temperature: 0.3,
    color: "#f59e0b",
    permission: {
      edit: "deny",
      bash: "deny",
      read: "allow",
      write: "allow",
      question: "allow",
      context_store: "allow",
    },
    category: "Specialist",
    risk: "low",
    modes: [
      { id: "resume", label: "Resume", description: "Achievement-first resume and CV optimization." },
      { id: "interview", label: "Interview", description: "Role-focused interview prep and rehearsal support." },
      { id: "strategy", label: "Strategy", description: "Long-horizon career direction and gap planning." },
    ],
    defaultMode: "resume",
    capabilities: ["read", "write", "question", "context_store"],
    bestFor: ["application materials", "interview preparation", "career planning"],
    handoffs: ["researcher", "teacher", "ideator", "codeexpert"],
  },
  codeexpert: {
    name: "codeexpert",
    description:
      "Code understanding, writing, and improvement. Modes: explain:[code], write:[code], improve:[code]. Maintains codebase knowledge.",
    prompt: "codeexpert",
    temperature: 0.2,
    color: "#f97316",
    permission: {
      read: "allow",
      write: "allow",
      edit: "allow",
      bash: "allow",
      websearch: "allow",
      webfetch: "allow",
      question: "allow",
      context_store: "allow",
    },
    category: "Specialist",
    risk: "high",
    modes: [
      { id: "explain", label: "Explain", description: "Code comprehension and architecture clarification." },
      { id: "write", label: "Write", description: "Implementation from requirements with guardrails." },
      { id: "improve", label: "Improve", description: "Refactor, optimize, and tighten reliability." },
      { id: "debug", label: "Debug", description: "Root-cause analysis and targeted fixes." },
    ],
    defaultMode: "explain",
    capabilities: ["read", "write", "edit", "bash", "websearch", "webfetch", "context_store"],
    bestFor: ["code review", "implementation", "debugging"],
    handoffs: ["researcher", "teacher", "ideator", "career"],
  },
}

export function isSpecialistAgentName(name: string): name is SpecialistAgentName {
  return name in AGENT_PROFILE_MANIFEST
}

export function specialistProfiles() {
  return Object.values(AGENT_PROFILE_MANIFEST)
}

export function getSpecialistProfile(name: string): AgentProfile | undefined {
  if (!isSpecialistAgentName(name)) return undefined
  return AGENT_PROFILE_MANIFEST[name]
}
