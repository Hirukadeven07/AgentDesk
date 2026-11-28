import type { AgentsDeckData } from '../data/types';
import type { MergeSummary } from './merge';
import { scan } from './scan';
import { fromGitHub, GitHubError } from './sources/github';
import { fromManifestText, fromPickedFiles, type PickedFile, type SourcedTree } from './sources/local';

/** Where a project comes from, as the connect dialog collects it. */
export type ConnectRequest =
  | { kind: 'github'; input: string }
  | { kind: 'folder'; files: PickedFile[] }
  | { kind: 'manifest'; text: string };

/** A connected project: what the app shows instead of the demo team. */
export interface Connected {
  name: string;
  data: AgentsDeckData;
  summary: MergeSummary;
  /** Files that were found but could not be used, from the source and every adapter. */
  warnings: string[];
}

export type ConnectResult = { ok: true; project: Connected } | { ok: false; error: string };

/** What every adapter looks for, for the message when a project has none of it. */
const LOOKS_FOR =
  'AgentsDeck looks for Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Cline, Roo Code, CrewAI and LangGraph files, SKILL.md skills, or an agentsdeck.json manifest.';

/**
 * Connects a project from any source: reads it into a file tree, scans it, and checks there is
 * something to show. Every failure becomes a message for the user, never an exception.
 */
export async function connectProject(req: ConnectRequest, fetchImpl: typeof fetch = fetch): Promise<ConnectResult> {
  let source: SourcedTree & { warnings?: string[] };
  try {
    if (req.kind === 'github') source = await fromGitHub(req.input, fetchImpl);
    else if (req.kind === 'folder') {
      if (!req.files.length) return { ok: false, error: 'That folder is empty.' };
      source = fromPickedFiles(req.files);
    } else {
      if (!req.text.trim()) return { ok: false, error: 'Paste the contents of an agentsdeck.json file first.' };
      source = fromManifestText(req.text);
    }
  } catch (e) {
    return { ok: false, error: e instanceof GitHubError ? e.message : `Could not read that project: ${e instanceof Error ? e.message : String(e)}` };
  }

  const { data, summary, warnings } = await scan(source.tree);
  const all = [...(source.warnings ?? []), ...warnings];
  if (!summary.agents && !summary.skills) {
    // a manifest that failed to parse explains itself better than the generic message
    const why = req.kind === 'manifest' && all.length ? all.join(' ') : `No agents or skills were found in ${source.name}. ${LOOKS_FOR}`;
    return { ok: false, error: why };
  }
  return { ok: true, project: { name: source.name, data, summary, warnings: all } };
}

/** "6 agents · 14 skills · 2 MCP servers from Claude Code, Cursor": what a connection found. */
export function describeFound(summary: MergeSummary, labels: Record<string, string>): string {
  const n = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;
  const parts = [n(summary.agents, 'agent'), n(summary.skills, 'skill'), ...(summary.mcpServers ? [n(summary.mcpServers, 'MCP server')] : [])];
  const from = summary.platforms.filter((p) => p !== 'agent-skills' && p !== 'manifest').map((p) => labels[p]);
  if (summary.platforms.includes('agent-skills')) from.push('SKILL.md');
  if (summary.platforms.includes('manifest')) from.push('agentsdeck.json');
  return `${parts.join(' · ')}${from.length ? ` from ${from.join(', ')}` : ''}`;
}
