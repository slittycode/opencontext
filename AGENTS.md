# OpenContext Agent Guide

This file is the repo-wide operating guide for coding agents working in OpenContext.

## Quickstart

Use the v1 bootstrap flow from a fresh clone:

```bash
git clone https://github.com/slittycode/opencontext.git
cd opencontext
bash ./script/bootstrap-v1.sh
opencontext
```

Notes:
- `bun` is required.
- `curl | bash` installer rollout is intentionally deferred until release artifacts are guaranteed.

## Source Of Truth

When changing built-in OpenContext agent behavior, use these files as primary references:

- Base and system agents: `packages/opencode/src/agent/agent.ts`
- OpenContext-specific agents: `packages/opencode/src/agent/context-agents.ts`
- OpenContext agent prompts: `packages/opencode/src/agent/prompt/*.txt`
- Provider/system prompts: `packages/opencode/src/session/prompt/*.txt`
- Config schema + loading precedence: `packages/opencode/src/config/config.ts`

## Agent And MCP Operations

- List configured agents in CLI: `opencontext agent list`
- Create a new agent scaffold: `opencontext agent create`
- List MCP servers: `opencontext mcp list`
- Authenticate MCP server: `opencontext mcp auth <name>`
- In TUI, MCP dialog slash command is `/mcps` (plural)

Config and auth locations:
- Global config directory: `~/.config/opencontext`
- Preferred global config file: `~/.config/opencontext/opencontext.json`
- MCP OAuth/token store: `~/.local/share/opencontext/mcp-auth.json`

## Validation Checklist

Before finishing changes that affect agent behavior, prompts, or onboarding:

1. `bun run typecheck`
2. `bun test`
3. `bun run --cwd packages/opencode script/build.ts --single --skip-install` (for binary/build path changes)
4. Confirm docs reflect any command, keybind, or path changes

## Guardrails

- Prefer `opencontext` naming in user-facing text. Keep `opencode` only where explicitly needed for compatibility.
- Keep bootstrap (`script/bootstrap-v1.sh`) as the canonical local onboarding path.
- Do not remove installer/upgrade gating until release artifacts are guaranteed.
- If you add a new built-in agent, include:
  - prompt file under `packages/opencode/src/agent/prompt/`
  - wiring in `packages/opencode/src/agent/context-agents.ts` or `packages/opencode/src/agent/agent.ts`
  - docs updates in `README.md`

## Troubleshooting

- TUI rendering/terminal corruption:
  - `reset && stty sane`
  - `hash -r`
  - `TERM=xterm-256color opencontext`
- If `/mcp` shows nothing in TUI, use `/mcps`.
