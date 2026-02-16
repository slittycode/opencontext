# OpenContext

> A multi-agent conversational AI platform forked from [OpenCode](https://github.com/anomalyco/opencode).

OpenContext extends OpenCode's powerful terminal interface with specialized agent personalities for diverse tasks beyond coding—research, teaching, creative ideation, and more.

![OpenContext Terminal UI](packages/web/src/assets/lander/screenshot.png)

---

## Installation

**Prerequisites:** [Bun](https://bun.sh) runtime

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Clone and bootstrap v1
git clone https://github.com/slittycode/opencontext.git
cd opencontext
bash ./script/bootstrap-v1.sh
# or: bun run bootstrap:v1

# Run
opencontext
```

`curl | bash` installer rollout is intentionally deferred until release artifacts are guaranteed.

---

## Usage

```bash
opencontext              # Launch interactive TUI
opencontext --help       # Show all commands
opencontext --version    # Show version
```

### Switching Agents

Press `Tab` or type `/agents` to switch between primary agent personalities:

| Agent              | Mode      | Description                                                     |
| ------------------ | --------- | --------------------------------------------------------------- |
| 🔧 **coding**      | primary   | Full-access coding agent (default)                              |
| 📋 **plan**        | primary   | Planning mode with file edits disabled                          |
| 🔍 **researcher**  | primary   | Multi-source research and evidence-based synthesis              |
| 🎓 **teacher**     | primary   | Adaptive explanations and guided learning                       |
| ✨ **ideator**     | primary   | Creative ideation and structured idea evaluation                |
| 📝 **career**      | primary   | Career strategy, CV/resume, interview preparation              |
| 🧰 **codeexpert**  | primary   | Code understanding, implementation, and improvement             |

Subagents also available: `general` and `explore`.
Legacy alias: `build` maps to `coding` and is hidden by default.
Each agent has tailored permissions and prompts for its specialty.

### MCP Servers

```bash
opencontext mcp list
opencontext mcp auth <server-name>
opencontext mcp add
```

In the TUI, open the MCP dialog with `/mcps` (plural).

---

## Key Features

- **Multi-Agent System** — Switch personalities on the fly with `Tab`
- **30+ LLM Providers** — Claude, OpenAI, Gemini, local models, and more
- **Session Management** — Continue conversations, fork sessions
- **No Git Required** — Works in any folder (folder-based project detection)
- **Premium TUI** — Beautiful terminal interface with streaming responses

---

## Configuration

Create `~/.config/opencontext/opencontext.json`:

```json
{
  "provider": {
    "anthropic": {
      "api_key": "sk-..."
    }
  },
  "default_agent": "researcher"
}
```

Compatibility: legacy `opencode.json` / `config.json` files are still read, but `opencontext.json` is preferred.

See [OpenCode docs](https://opencode.ai/docs) for full configuration options.

---

## Agent Documentation

For implementation details and contributor guidance:

- Repo-wide agent guide: `AGENTS.md`
- Core package guide: `packages/opencode/AGENTS.md`
- Built-in OpenContext agent definitions: `packages/opencode/src/agent/context-agents.ts`
- Agent prompts: `packages/opencode/src/agent/prompt/`

---

## Creating Custom Agents

Add custom agents in your config:

```json
{
  "agent": {
    "advisor": {
      "description": "Strategic business advisor",
      "prompt": "You are a strategic advisor...",
      "mode": "primary"
    }
  }
}
```

---

## Architecture

OpenContext uses OpenCode's client-server architecture:

- **TUI Client** — React-based terminal interface (@opentui)  
- **Backend Server** — Bun/Hono server handling LLM calls and tools
- **Agent System** — Permission-based tool access per agent personality

---

## Credits

Forked from [OpenCode](https://github.com/anomalyco/opencode) by the Anomaly team.
OpenContext adds multi-personality agent support for general-purpose use.

---

## License

MIT
