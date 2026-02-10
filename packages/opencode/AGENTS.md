# OpenContext Core Agent Guidelines (`packages/opencode`)

This file is package-scoped guidance for agents working in the OpenContext core CLI/TUI package.

## Primary Commands

Run from repo root unless noted:

- Install deps: `bun install`
- Core dev run: `bun run --cwd packages/opencode --conditions=browser src/index.ts`
- Typecheck (workspace): `bun run typecheck`
- Test (core package): `bun --cwd packages/opencode test`
- Single test file: `bun --cwd packages/opencode test test/path/to/file.test.ts`
- Build single local binary: `bun run --cwd packages/opencode script/build.ts --single --skip-install`

## High-Value File Map

- CLI entrypoint + command wiring: `packages/opencode/src/index.ts`
- Agent registry + defaults: `packages/opencode/src/agent/agent.ts`
- OpenContext-specific built-in agents: `packages/opencode/src/agent/context-agents.ts`
- OpenContext agent prompt text: `packages/opencode/src/agent/prompt/*.txt`
- TUI command palette/slash commands: `packages/opencode/src/cli/cmd/tui/app.tsx`
- MCP CLI commands: `packages/opencode/src/cli/cmd/mcp.ts`
- Config schema and config load precedence: `packages/opencode/src/config/config.ts`
- Server routes: `packages/opencode/src/server/server.ts`

## Naming And Compatibility Rules

- Prefer `opencontext` in all user-facing copy.
- Keep `opencode` aliases only where compatibility is explicitly intended.
- Do not ungate installer/upgrade release behavior until release artifacts are guaranteed.

## Agent Changes Checklist

If you add or modify built-in agents:

1. Update agent definitions in `packages/opencode/src/agent/agent.ts` or `packages/opencode/src/agent/context-agents.ts`.
2. Add/update prompt files in `packages/opencode/src/agent/prompt/`.
3. Ensure prompts are tracked in git and included in packaging paths.
4. Update user-facing docs in `README.md` when visible behavior changes.
5. Validate with `bun run typecheck` and `bun --cwd packages/opencode test`.

## MCP Behavior Notes

- CLI uses `opencontext mcp ...` commands.
- TUI slash command for MCP dialog is `/mcps` (plural).
- MCP auth/token storage path is `~/.local/share/opencontext/mcp-auth.json`.

## Implementation Conventions

- Runtime: Bun + TypeScript (ESM).
- Validation: Zod schemas for config/input boundaries.
- Logging: `Log.create({ service: "..." })`.
- Keep file-level abstractions namespace-oriented and explicit (`Tool`, `Session`, `Config`, `Agent`).
- Prefer additive compatibility migrations over abrupt config breakage.

## API/SDK Synchronization

If server routes change, regenerate SDK artifacts before finalizing:

- `./script/generate.ts`
