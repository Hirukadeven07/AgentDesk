import type { Level, LevelInfo, RoomInfo, StationId, Tier } from '../types';

export const ROOMS: Record<StationId, RoomInfo> = {
  dispatch: { purpose: 'Where agents pick up new tickets and hand finished work back.', kit: [['Reception counter', '1'], ['Ticket queue screen', '1'], ['Waiting sofa', '1']], backlog: ['#483 Update README badges', '#484 Bump lodash to 4.17.22', '#485 Investigate 502s on /cart', '#486 Draft release notes for 3.2'] },
  terminal: { purpose: 'Shell access for builds, tests and ops commands.', kit: [['Desk with terminal', '3'], ['Office chair', '3'], ['Build runner rack', '2']], backlog: ['npm run build:prod', 'pytest services/billing', 'terraform plan infra/staging'] },
  editor: { purpose: 'Reading and editing code, and leaving review comments.', kit: [['Desk with two monitors', '2'], ['Office chair', '2']], backlog: ['Review PR #93 (search filters)', 'Refactor cart/totals.ts'] },
  web: { purpose: 'Searching and reading the web.', kit: [['Desk with browser', '2'], ['Office chair', '2'], ['Plant', '1']], backlog: ['Find pricing for 3 vector DB vendors', 'Check status page for upstream outage'] },
  archive: { purpose: 'Reading and writing project files and logs.', kit: [['Filing cabinet', '3'], ['Bookshelf, 3 m', '1'], ['Plant', '1']], backlog: ['Index docs/ for new contributors'] },
  planning: { purpose: 'Glass meeting room for plans, tables and handoffs.', kit: [['Meeting table', '1'], ['Office chair', '4'], ['Whiteboard', '1']], backlog: ['Sprint 15 outline', 'Postmortem for #470'] },
  stateless: { purpose: 'Pickup point for stateless skills. The skills themselves run on level B1.', kit: [['Skill kiosk', '3'], ['Reference shelf, 3 m', '1']], backlog: [] },
  stateful: { purpose: 'Pickup point for stateful skills. The skills and their stores run on level B1.', kit: [['Skill vault', '1'], ['Reference shelf, 2.5 m', '1'], ['Plant', '1']], backlog: [] },
};

export const TIERS: Tier[] = [
  { level: 3, name: 'ORCHESTRATORS', agentIds: ['vega', 'orion'] },
  { level: 2, name: 'SPECIALISTS', agentIds: ['juniper', 'rook', 'sable', 'lumen'] },
  { level: 1, name: 'WORKERS', agentIds: ['atlas', 'pico', 'nova', 'quill', 'tern'] },
];

export const MODEL_BY_LEVEL: Record<Level, string> = { 3: 'claude-opus-5-5', 2: 'claude-sonnet-5-5', 1: 'claude-haiku-5-5' };

export const LEVELS: Record<Level, LevelInfo> = {
  3: { title: 'Orchestrators', summary: 'Plan the work, split it into tickets and hand those tickets to other agents. They decide who does what and check the results.',
    does: ['Break goals into tickets', 'Assign tickets to L2 and L1 agents', 'Review results before work is closed', 'Keep the plan and tracker up to date'],
    cant: ['No limits on who they can hand work to', 'Still need a human to approve production changes'],
    cfg: { model: MODEL_BY_LEVEL[3], turns: 80, files: 'yes', shell: 'only through workers', handoff: 'any agent', budget: '$4.00 per task' } },
  2: { title: 'Specialists', summary: 'Own one kind of skilled work from start to finish: research, code review, security checks or docs.',
    does: ['Take a ticket and finish it without help', 'Use the skills for their speciality', 'Write findings, reviews or docs', 'Escalate to L3 when a ticket is unclear'],
    cant: ['Can only hand work up to L3', 'No production access', 'Shell commands only where their role needs it'],
    cfg: { model: MODEL_BY_LEVEL[2], turns: 40, files: 'yes', shell: 'role-dependent', handoff: 'L3 only', budget: '$1.50 per task' } },
  1: { title: 'Workers', summary: 'Do focused, repeatable jobs quickly: builds, ops tasks, data jobs, QA runs and triage.',
    does: ['Run builds, tests and scripts', 'Move, clean and index data', 'Triage incoming requests', 'Report back to the agent that assigned the job'],
    cant: ['Cannot hand work to other agents', 'Write access limited to the repo they were given', 'Short tasks only, 20 turns at most'],
    cfg: { model: MODEL_BY_LEVEL[1], turns: 20, files: 'repo only', shell: 'yes, sandboxed', handoff: 'none, report back only', budget: '$0.30 per task' } },
};
