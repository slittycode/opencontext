# Changelog

## [Unreleased] — 2026-02-15

### Agent Profile Consolidation

**9 OpenContext agents → 5 deeply comprehensive agents**

#### New Agents

- **`researcher`** — Merges `research` + `deep-researcher`. Modes: Quick, Deep, Academic. Full credibility evaluation, multi-source cross-referencing, and structured output with citations.
- **`teacher`** — Merges `socratic` + `tutor` + `educator`. Modes: Explain (progressive depth), Socratic (question-driven discovery), Guided (step-by-step with checkpoints). Grounded in adaptive pedagogy.
- **`career`** — Replaces `cv-review` with broader scope: CV/resume review, cover letters, LinkedIn profiles, professional correspondence, interview prep, career strategy.

#### Modified Agents

- **`ideator`** — Absorbs `brainstorm`. Enhanced with broader creative philosophy, constraints, and agent awareness.
- **`codeexpert`** — Renamed from `code-expert` (no hyphens). Added Related Agents and Constraints sections.

#### Removed Agents

- `research` → replaced by `researcher`
- `deep-researcher` → replaced by `researcher`
- `socratic` → replaced by `teacher`
- `tutor` → replaced by `teacher`
- `brainstorm` → replaced by `ideator`
- `cv-review` → replaced by `career`

#### Other Changes

- All prompts standardized to consistent template: Identity, Modes, Workflow, Output Format, Knowledge Persistence, Related Agents, Principles, Constraints
- Temperature tuning per role: researcher 0.2, teacher 0.4, ideator 0.8, career 0.3, codeexpert 0.2
- Fixed permission/prompt misalignment — all `context_store` permissions now documented in prompts
- No hyphens in agent display names
