# OpenContext Core (`packages/opencode`)

Core CLI/TUI runtime for OpenContext (forked from OpenCode).

## Local Development

From repo root:

```bash
bun install
bun run --cwd packages/opencode --conditions=browser src/index.ts
```

Or from this directory:

```bash
bun install
bun run --conditions=browser ./src/index.ts
```

## Validate Changes

From repo root:

```bash
bun run typecheck
bun --cwd packages/opencode test
```

For binary/build path changes:

```bash
bun run --cwd packages/opencode script/build.ts --single --skip-install
```

## Key Paths

- Agent registry: `src/agent/agent.ts`
- OpenContext agents: `src/agent/context-agents.ts`
- Agent prompts: `src/agent/prompt/`
- TUI slash commands/dialogs: `src/cli/cmd/tui/`
- MCP command surface: `src/cli/cmd/mcp.ts`
- Config schema/loading: `src/config/config.ts`

For contributor/agent-specific working rules, see `AGENTS.md` in this directory and repo root.
