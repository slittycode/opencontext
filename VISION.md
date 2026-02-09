# OpenContext Vision

> A multi-agent conversational AI platform for diverse tasks beyond coding.

---

## Origin

OpenContext is a fork of [OpenCode](https://github.com/anomalyco/opencode), the open-source terminal-based AI coding assistant. While OpenCode excels at coding tasks, OpenContext expands the vision to support **any conversational task**—research, teaching, creative ideation, career coaching, and more.

---

## Core Philosophy

### From "Code" to "Context"

OpenCode's architecture—agents with tailored permissions, session persistence, multi-provider LLM support—is powerful for more than just coding. OpenContext leverages this infrastructure for general-purpose AI interactions:

- **Agent Personas** — Switch between specialized personalities (research, tutor, brainstorm) rather than a single "coding" mode
- **Discussion Workspaces** — Any folder becomes a context (no git repository required)
- **Permission-Based Tools** — Each agent has appropriate capabilities (research can search the web but can't edit files)

### Design Principles

1. **Versatility Over Specialization** — One tool that adapts to the task
2. **Context Preservation** — Conversations persist and can be resumed
3. **User Autonomy** — Custom agents via simple configuration
4. **Terminal-Native** — Beautiful TUI for focused, distraction-free work

---

## Scope

### In Scope (v1.0)

| Feature | Status |
|---------|--------|
| Multi-agent system with switchable personalities | ✅ Implemented |
| Research agent with web search | ✅ Implemented |
| Socratic teaching agent | ✅ Implemented |
| CV/resume review agent | ✅ Implemented |
| Brainstorm/ideation agent | ✅ Implemented |
| Tutor agent for learning | ✅ Implemented |
| Folder-based project detection (no git required) | ✅ Implemented |
| All OpenCode coding features (build, plan agents) | ✅ Preserved |
| 30+ LLM provider support | ✅ Inherited |
| Custom agent configuration | ✅ Inherited |

### Future Roadmap (v1.1+)

- **Computer Capability Facade** — Unified namespace for browser, files, terminal
- **Pluggable Execution Backend** — Local, container, or remote sandbox execution
- **Agent Memory** — Long-term context across sessions
- **Team Collaboration** — Shared sessions and agent handoffs

### Out of Scope

- Mobile/web interface (terminal-first)
- Real-time collaboration (single-user focus)
- Proprietary model lock-in (multi-provider by design)

---

## Technical Decisions

### Why Fork OpenCode?

| Consideration | Decision |
|---------------|----------|
| Codebase maturity | OpenCode has a production-grade agent/permission system |
| Architecture fit | Existing agent switching via `Tab`/`/agent` |
| Provider support | 30+ LLM providers already integrated |
| License | MIT — allows derivative work |

### What Was Changed

1. **Rebranding** — `opencode` → `opencontext` in package names, CLI, and prompts
2. **Agent Expansion** — Added 5 new agent personalities with tailored prompts/permissions
3. **Project Detection** — Folder-based hashing instead of requiring `.git`
4. **System Prompts** — Updated to reflect versatile AI assistant role

### What Was Preserved

- Full coding agent capabilities (`build`, `plan`)
- TUI architecture and styling
- Session management and persistence
- All tool implementations
- LLM provider integrations
- Configuration system

---

## Developer Notes

### Running Locally

```bash
bun install
ln -sf $(pwd)/packages/opencode/bin/opencontext ~/.bun/bin/opencontext
opencontext
```

### Adding New Agents

Agents are defined in `packages/opencode/src/agent/agent.ts`:

```typescript
"my-agent": {
  name: "my-agent",
  description: "Description shown in agent picker",
  permission: PermissionNext.merge(defaults, user, {
    read: "allow",
    websearch: "allow",
    // deny tools as needed
  }),
  prompt: "Your system prompt here...",
  mode: "primary",
  color: "#hexcolor",
}
```

### Project Structure

```
packages/
  opencode/           # Main package (name preserved for workspace resolution)
    src/
      agent/          # Agent definitions and prompts
      session/        # Session management, system prompts
      project/        # Project detection (modified for folder-based)
      tool/           # Tool implementations
    bin/
      opencontext     # CLI entry point
```

---

## Motivation

The developer's goal was to have a single, powerful terminal tool that adapts to context:

- **Morning research session** → Switch to `research` agent
- **Afternoon coding** → Switch to `build` agent  
- **Evening learning** → Switch to `tutor` agent
- **Job hunting** → Switch to `cv-review` agent

One persistent tool, many personalities, all conversations preserved.

---

## Credits

- [OpenCode](https://github.com/anomalyco/opencode) by the Anomaly team — the foundation
- Architecture patterns inspired by various AI assistants
- Built with [Bun](https://bun.sh), [React Ink](https://github.com/vadimdemedes/ink), [Hono](https://hono.dev)

---

## License

MIT (inherited from OpenCode)
