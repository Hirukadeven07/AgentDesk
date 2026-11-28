import type { MergeSummary } from './merge';

/** "6 agents · 14 skills · 2 MCP servers from Claude Code, Cursor": what a connection found. */
export function describeFound(summary: MergeSummary, labels: Record<string, string>): string {
  const n = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;
  const parts = [n(summary.agents, 'agent'), n(summary.skills, 'skill'), ...(summary.mcpServers ? [n(summary.mcpServers, 'MCP server')] : [])];
  const from = summary.platforms.filter((p) => p !== 'agent-skills' && p !== 'manifest').map((p) => labels[p]);
  if (summary.platforms.includes('agent-skills')) from.push('SKILL.md');
  if (summary.platforms.includes('manifest')) from.push('agentsdeck.json');
  return `${parts.join(' · ')}${from.length ? ` from ${from.join(', ')}` : ''}`;
}
