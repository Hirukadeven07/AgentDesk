# AgentsDeck

<p align="center">
  <img src="assets/agentsdeck-banner.webp" alt="AgentsDeck" width="100%">
</p>

AgentsDeck shows your AI agents and skills as an architectural model of an office, whatever you build them with: Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Cline, Roo Code, CrewAI, LangGraph, or cloud agents you describe yourself. Agents stand on a roster by level, every skill has its own rack, and a demo team shows how agents walk the floor to do their tasks.

**Open it: [agentsdeck.vercel.app](https://agentsdeck.vercel.app)**

There's nothing to install or sign up for. It works in any modern browser, on a computer or a phone.

It opens on a demo team. Choose **Connect your project** to see your own.

## Connect your project

**Connect your project**, next to the layer toggle, gives you three ways in:

- **GitHub link**: paste a public repository, such as `https://github.com/owner/repo`. A link to a branch or folder works too.
- **Folder on this computer**: pick the folder at the top of your project. You can also pick `~/.claude` or `~/.codex` to see your own agents and skills.
- **Paste a manifest**: paste an [`agentsdeck.json`](docs/manifest.md) for cloud agents, or anything AgentsDeck can't read from files.

AgentsDeck reads these files:

| Built with | Agents | Skills, rules and commands | MCP servers |
| --- | --- | --- | --- |
| Claude Code | `CLAUDE.md`, `.claude/agents/`, plugins | `.claude/skills/`, `.claude/commands/` | `.mcp.json` |
| Codex | `AGENTS.md`, `.codex/agents/*.toml`, roles in `.codex/config.toml` | `.agents/skills/`, `.codex/skills/` | `.codex/config.toml` |
| Cursor | `.cursorrules` and always-on rules, `.cursor/agents/` | `.cursor/rules/`, `.cursor/commands/`, `.cursor/skills/` | `.cursor/mcp.json` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/agents/`, `.github/chatmodes/` | `.github/instructions/`, `.github/prompts/`, `.github/skills/` | `.vscode/mcp.json` |
| Gemini CLI | `GEMINI.md`, `.gemini/agents/`, extensions | `.gemini/commands/`, `.gemini/skills/` | `.gemini/settings.json` |
| Windsurf | `.windsurfrules` and always-on rules | `.windsurf/rules/`, `.windsurf/workflows/`, `.windsurf/skills/` | in your own settings, not the project |
| Cline | `.clinerules` and rules without `paths` | rules with `paths`, `.clinerules/workflows/`, `.cline/skills/` | in your own settings, not the project |
| Roo Code | `.roorules`, `.roo/rules/`, custom modes in `.roomodes` | `.roo/rules-<mode>/`, `.roo/commands/`, `.roo/skills/` | `.roo/mcp.json` |
| CrewAI | `config/agents.yaml` (and who runs each task, from `crew.py`) | `config/tasks.yaml` | |
| LangGraph | each graph in `langgraph.json`, with its nodes and `@tool` functions | | |
| Anything else | [`agentsdeck.json`](docs/manifest.md) | [`agentsdeck.json`](docs/manifest.md) | [`agentsdeck.json`](docs/manifest.md) |

`SKILL.md` skills are read wherever they are.

Once connected:

- **The roster** shows your main agents at L3, your custom agents at L2, and CrewAI agents at L1.
- **The skills layer** gives each skill its own rack.
- **A detail window** shows an agent's description, its instructions, and the file it came from. Tap any agent or rack to open it.
- **Big projects** are shown a page at a time.
- **The strip at the top** says what was found and lists any files it couldn't use.

**Live activity is not connected yet**, so your agents wait on the roster rather than walking the floor.

**Nothing is stored on a server.** A folder's files are read in your browser and never uploaded. A GitHub repository is read straight from GitHub, without signing in. Your browser keeps the connected project until you choose **Back to demo**. A GitHub project can be shared with **Copy link**, which gives an address like `agentsdeck.vercel.app/?repo=owner/repo`.

## What you'll see

The toggle at the top switches between three layers:

- **Agent floor**: the office seen from above at an angle, with the roof off. Agents walk the corridor to whichever station their next tool call needs.
- **Skills layer**: the level below, with two rooms of GPU racks, one skill per rack. Stateless skills are on the left, stateful skills (they keep memory between calls) are on the right. A rack lights up while an agent uses it.
- **Agent roster**: every agent lined up on steps by level, like a group photo. The demo team has L3 orchestrators, L2 specialists and L1 workers.

## How to use it

- **Tap anything** (an agent, a room, a rack or a step) to open a detail window with tabs. On a computer it sits in the bottom-right corner of the model. On a phone it slides up from the bottom; drag it down to close it.
- **Follow an agent** by tapping it in the *Agents on the floor* list beside the model.
- **Change the speed** with **Pause**, **1×** and **3×** next to the clock.
- **Share a layer**: the address changes as you switch layers, so a link like [agentsdeck.vercel.app/#skills](https://agentsdeck.vercel.app/#skills) opens straight on that layer.

### Keyboard shortcuts

| Key | What it does |
| --- | --- |
| `1` `2` `3` | Switch to the agent floor, skills layer or agent roster |
| `Space` | Pause, or resume at the speed you had before |
| `Esc` | Close the detail window |
| `←` `→` `Home` `End` | Move between the detail window's tabs |

## Coming later

- **Live activity:** your agents walking the floor as they really work, from each tool call they make.
- **Private repositories**, and agents in your home folder without picking it.

---

Working on the code? See [docs/development.md](docs/development.md).
