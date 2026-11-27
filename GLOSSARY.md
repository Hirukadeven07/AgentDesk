# Glossary

The words AgentsDeck uses for its own ideas. Use them as written here in code, issues and pull requests.

## The model

- **Agent floor**: the office layer, seen from above with the roof off. Agents walk between **stations** to do the steps of a task. Avoid: map, board.
- **Station**: a room on the agent floor where one kind of work happens (`dispatch`, `terminal`, `editor`, `web`, `archive`, `planning`, plus the two skill rooms). Avoid: zone, area.
- **Skills layer**: the level below the agent floor. It has one **rack** per skill.
- **Rack**: the place a skill appears on the skills layer. It lights up while an agent uses that skill.
- **Stateless skill** (`sl`) / **stateful skill** (`sf`): whether a skill keeps memory between calls. They sit in the left room and the right room of the skills layer.
- **Agent roster**: every agent on steps by **level**, like a group photo.
- **Level**: how much an agent may do. L3 orchestrators, L2 specialists, L1 workers. One level's agents together are a **tier**. Avoid: rank, grade.

## Connecting a project

- **Platform**: the tool or framework a setup was made for, such as Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, CrewAI or a cloud service. Avoid: environment, provider, vendor.
- **Source**: where a project's files come from: a local folder, a GitHub repo, or a **manifest** file. A source produces a **file tree**. Avoid: connector, when you mean only this part.
- **File tree**: the read-only list of a project's files that a source hands to the adapters. It skips folders like `node_modules` and limits file sizes.
- **Adapter**: the code for one platform. It reads a file tree and reports the agents and skills it finds there. Avoid: parser, plugin.
- **Discovery**: what one adapter reports for one file tree: agents, skills and MCP servers, each with its platform and the path of the file it came from.
- **Merger**: combines every discovery into one `AgentsDeckData` object. It places agents in tiers, places skills on racks, and merges duplicates.
- **Manifest**: an `agentsdeck.json` file that describes agents and skills directly. It covers any platform that has no adapter yet, including cloud agents.
- **Connected project**: the `AgentsDeckData` built from a user's own source, as opposed to the **demo team** from the mock data.
- **Primary agent**: the agent a platform runs by default, described by an instructions file such as `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`. Shown at L3.
- **Custom agent**: an agent a user defines for a platform, such as a Claude Code subagent in `.claude/agents/`. Shown at L2. Avoid: subagent, except when quoting a platform's own docs.
