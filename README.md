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

# Clone and setup
git clone https://github.com/YOUR_USERNAME/opencontext.git
cd opencontext
bun install

# Link CLI globally
ln -sf $(pwd)/packages/opencode/bin/opencontext ~/.bun/bin/opencontext

# Run
opencontext
```

---

## Usage

```bash
opencontext              # Launch interactive TUI
opencontext --help       # Show all commands
opencontext --version    # Show version
```

### Switching Agents

Press `Tab` or type `/agent` to switch between agent personalities:

| Agent            | Description                          |
| ---------------- | ------------------------------------ |
| 🔧 **build**     | Full-access coding agent (default)   |
| 📋 **plan**      | Read-only code exploration           |
| 🔍 **research**  | Deep research, web search, synthesis |
| 🎓 **socratic**  | Teaching through questions           |
| 📝 **cv-review** | Resume/CV analysis and improvement   |
| 💭 **brainstorm**| Creative ideation and exploration    |
| 📚 **tutor**     | Patient explanations and learning    |

Each agent has tailored permissions and prompts for its specialty.

---

## Key Features

- **Multi-Agent System** — Switch personalities on the fly with `Tab`
- **30+ LLM Providers** — Claude, OpenAI, Gemini, local models, and more
- **Session Management** — Continue conversations, fork sessions
- **No Git Required** — Works in any folder (folder-based project detection)
- **Premium TUI** — Beautiful terminal interface with streaming responses

---

## Configuration

Create `~/.config/opencontext/config.json`:

```json
{
  "provider": {
    "anthropic": {
      "api_key": "sk-..."
    }
  },
  "default_agent": "research"
}
```

See [OpenCode docs](https://opencode.ai/docs) for full configuration options.

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
