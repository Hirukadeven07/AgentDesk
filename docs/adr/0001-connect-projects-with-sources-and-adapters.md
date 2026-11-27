# 1. Connect projects with sources, adapters and a merger

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

AgentsDeck shows only the demo team from `src/data/mock/`. People should be able to connect their own project and see their own agents and skills on the agent floor, the skills layer and the agent roster.

People build agents with many platforms, and each one stores them differently:

- Claude Code uses `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, `CLAUDE.md` and `.mcp.json`.
- Codex uses `AGENTS.md` and `.codex/config.toml`.
- Cursor uses `.cursor/rules/*.mdc` and `.cursor/mcp.json`.
- GitHub Copilot uses `.github/agents/*.agent.md` and `.github/copilot-instructions.md`.
- Gemini CLI uses `GEMINI.md` and `.gemini/`.
- Frameworks such as CrewAI and LangGraph keep agents in YAML or JSON config.
- Cloud agents live behind APIs and have no files in the repo at all.

Several platforms share the Agent Skills format (`SKILL.md` with YAML frontmatter), so one skill folder can serve more than one platform.

The UI and the renderers already read everything through one type, `AgentsDeckData` in `src/data/types.ts`. The app is a static site on Vercel with no server.

## Decision

Connecting a project runs in three parts, all in the browser:

```
source ──▶ file tree ──▶ adapters (one per platform) ──▶ discoveries ──▶ merger ──▶ AgentsDeckData
```

1. A **source** turns where the project lives into a **file tree**. The first sources are a local folder, a public GitHub repo, and a manifest file.
2. Each **adapter** knows one platform. It checks whether the platform is present in the file tree. If it is, it reports a **discovery**: the agents, skills and MCP servers it found, each with its platform and source file path.
3. The **merger** builds one `AgentsDeckData` from all discoveries. Primary agents go to L3, custom agents to L2, and agents that cannot hand off work to L1. A skill that appears more than once with the same content becomes one rack.

Any platform without an adapter, including cloud agents, is covered by the **manifest**: an `agentsdeck.json` file with a published JSON Schema.

New code lives in `src/connect/`. Adding a platform means adding one adapter file and its test fixtures, with no change to the UI.

Files are read in the browser and never uploaded. The app stores the parsed result in `localStorage`, never tokens.

## Consequences

- One platform's quirks stay in its adapter. The UI keeps reading `AgentsDeckData`, so the floor, skills layer and roster work unchanged.
- `AgentsDeckData` must allow fields that only the demo team has, such as latency and success rate. The windows have to handle a missing value.
- A connected project shows who the agents are and what they can do, but not live activity. Agents walking the floor from real tool calls needs a local process. That is a later decision, together with a CLI for private repos, home folders such as `~/.claude`, and cloud APIs whose keys must stay on the user's machine.
- Platforms change their file layouts. Each adapter is checked against that platform's current docs when it is written, and its fixtures copy the real layout.
- Reading a GitHub repo without signing in is limited to 60 API calls an hour. A scan uses one, because file contents come from `raw.githubusercontent.com`.
