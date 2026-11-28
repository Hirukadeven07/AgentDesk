# The `agentsdeck.json` manifest

AgentsDeck reads agents and skills straight from the files of most platforms: Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Cline, Roo Code, CrewAI, LangGraph and `SKILL.md` skills.

For anything else, write an `agentsdeck.json` file. This covers:

- **cloud agents** with no files in your repo, such as Amazon Bedrock agents, Vertex AI agents, OpenAI or Claude managed agents, n8n or Zapier workflows
- **your own framework**, or one AgentsDeck has no adapter for yet
- **agents you want to describe by hand**, for example to show a team you are planning

Put the file anywhere in your project, or paste it straight into AgentsDeck. You can have more than one.

## A small example

```json
{
  "$schema": "https://agentsdeck.vercel.app/agentsdeck.schema.json",
  "version": 1,
  "agents": [
    {
      "id": "support-bot",
      "name": "Support Bot",
      "kind": "primary",
      "description": "Answers customer tickets and hands hard ones to a human.",
      "provider": "Amazon Bedrock",
      "model": "anthropic.claude-sonnet-5-5",
      "tools": ["search_orders", "refund"],
      "skills": ["refund-policy"]
    }
  ],
  "skills": [
    {
      "id": "refund-policy",
      "description": "Decides whether an order can be refunded.",
      "instructions": "Refund within 30 days of delivery. Never refund gift cards."
    }
  ],
  "mcpServers": ["orders-db"]
}
```

## Fields

The `$schema` line is optional. It lets your editor check the file and complete field names as you type.

| Field | Required | What it is |
| --- | --- | --- |
| `version` | yes | Always `1`. |
| `agents` | no | A list of agents. |
| `skills` | no | A list of skills. |
| `mcpServers` | no | Names of the MCP servers your agents use. |

### Agents

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | A name that is unique in this file. Skills refer to agents by it. |
| `name` | no | The name shown in AgentsDeck. Defaults to the `id`. |
| `kind` | no | `primary` for the agent that runs by default (shown at the top level), or `custom` (the default) for one you defined. |
| `description` | no | What the agent does and when to use it. |
| `instructions` | no | Its system prompt. |
| `model` | no | The model it runs on. |
| `provider` | no | Where it runs, such as `Amazon Bedrock`, `Vertex AI` or `n8n`. Shown with the description. |
| `tools` | no | The tools it can call. |
| `skills` | no | The `id`s of the skills it uses. |

### Skills

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | A name that is unique in this file. |
| `description` | yes | What the skill does. |
| `instructions` | no | The skill's instructions. |

## What AgentsDeck checks

AgentsDeck shows a warning, and still shows everything else, when:

- the file is not valid JSON, or `version` is not `1`
- an agent or skill has no `id`, or two have the same `id`
- a skill has no `description`

An agent's `skills` can name skills defined elsewhere in the project too, such as a `SKILL.md`.
