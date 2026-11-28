import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppContext, type AppCtx } from '../components/actions';
import { agentWindow } from '../components/windows/AgentWindow';
import { levelWindow } from '../components/windows/LevelWindow';
import { roomWindow } from '../components/windows/RoomWindow';
import { skillWindow } from '../components/windows/SkillWindow';
import type { StationId } from '../data/types';
import { Simulation } from '../sim/simulation';
import { memoryTree } from './fileTree';
import { scan } from './scan';
import type { Adapter } from './types';

/** One project using several tools at once, as many real ones do. */
const project = memoryTree({
  'CLAUDE.md': 'Run the tests first.\n',
  '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Reviews diffs.\ntools: Read, Grep\nskills: [pr]\n---\nReview.\n',
  '.claude/skills/pr/SKILL.md': '---\nname: pr\ndescription: Write a PR body.\n---\nUse the template.\n',
  '.agents/skills/pr/SKILL.md': '---\nname: pr\ndescription: Write a PR body.\n---\nUse the template.\n',
  '.mcp.json': JSON.stringify({ mcpServers: { github: {} } }),
  'AGENTS.md': 'Use pnpm.\n',
  '.cursor/rules/react.mdc': '---\nglobs: *.tsx\n---\nUse hooks.\n',
  'crew/config/agents.yaml': 'researcher:\n  role: Researcher\n',
  'crew/config/tasks.yaml': 'research:\n  description: Research it.\n  agent: researcher\n',
  'agentsdeck.json': JSON.stringify({ version: 1, agents: [{ id: 'support-bot', provider: 'Amazon Bedrock' }] }),
});

describe('scan', () => {
  it('runs every adapter that recognises the project and merges what they find', async () => {
    const { data, summary, warnings } = await scan(project);
    expect(warnings).toEqual([]);
    expect(summary).toMatchObject({ agents: 6, platforms: ['claude-code', 'codex', 'cursor', 'agent-skills', 'crewai', 'manifest'], duplicates: 1 });
    expect(data.tiers.map((t) => [t.level, t.agentIds])).toEqual([
      [3, ['claude-code', 'codex', 'cursor']],
      [2, ['reviewer', 'support-bot']],
      [1, ['researcher']],
    ]);
    // the same pr skill in .claude/skills and .agents/skills is one rack; the reviewer and Claude Code both use it
    // racks follow the adapter order: Cursor's rule, then SKILL.md skills, then CrewAI tasks
    expect(Object.keys(data.skills)).toEqual(['react', 'pr', 'research']);
    expect(data.offFloorAgents.find((a) => a.id === 'reviewer')!.skills).toEqual(['pr']);
    expect(data.offFloorAgents.find((a) => a.id === 'claude-code')).toMatchObject({ skills: ['pr'], tools: ['mcp__github'] });
  });

  it('keeps going when one adapter fails, and says which', async () => {
    const broken: Adapter = { id: 'cline', label: 'Broken', detect: () => true, parse: () => Promise.reject(new Error('boom')) };
    const { warnings } = await scan(memoryTree({ 'x.md': '' }), [broken]);
    expect(warnings).toEqual(['Broken could not read this project: boom']);
  });

  it('produces data every window can show without "undefined" or "NaN"', async () => {
    const { data } = await scan(project);
    const ctx: AppCtx = { data, sim: new Simulation(data), actions: { follow: () => {}, open: () => {}, close: () => {}, setView: () => {} } };
    const html = (w: ReturnType<typeof agentWindow>) =>
      w!.tabs.map(([id]) => renderToStaticMarkup(<AppContext.Provider value={ctx}>{w!.body(id)}</AppContext.Provider>)).join('') + w!.title + w!.sub;
    const all = [
      ...data.offFloorAgents.map((a) => html(agentWindow(a.id, ctx))),
      ...Object.keys(data.skills).map((id) => html(skillWindow(id, ctx))),
      ...([1, 2, 3] as const).map((l) => html(levelWindow(l, ctx))),
      ...(Object.keys(data.rooms) as StationId[]).map((id) => html(roomWindow(id, ctx))),
    ];
    for (const h of all) expect(h).not.toMatch(/\bundefined\b|\bNaN\b/);
  });
});
