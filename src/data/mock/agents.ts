import type { AgentStep, StationId } from '../types';

type RawStep = [StationId, string, string, number];
const steps = (list: RawStep[]): AgentStep[] =>
  list.map(([station, text, tool, duration]) => ({ station, text, tool, duration }));

/** The five agents walking the floor, each looping through a scripted task. */
export const FLOOR_AGENTS = [
  {
    id: 'atlas', name: 'Atlas', role: 'Build agent', task: 'Fix failing checkout test',
    steps: steps([
      ['dispatch', 'Picked up ticket #482: checkout test is failing', 'read_ticket', 3],
      ['archive', 'Reading src/cart/checkout.ts', 'read_file', 4],
      ['terminal', '$ npm test -- checkout   ✗ 1 failed', 'bash', 5],
      ['stateless', 'Skill test-runner isolated case "applies 15% promo"', 'test-runner', 3.5],
      ['editor', 'Editing checkout.ts: round totals to cents', 'edit_file', 5],
      ['terminal', '$ npm test   ✓ 42 passed', 'bash', 4],
    ]),
  },
  {
    id: 'juniper', name: 'Juniper', role: 'Research agent', task: 'Compare vector databases',
    steps: steps([
      ['dispatch', 'Picked up: compare vector DBs for search', 'read_ticket', 3],
      ['web', 'Searching "pgvector vs qdrant p95 latency"', 'web_search', 5],
      ['web', 'Reading a 3,200-word benchmark write-up', 'web_fetch', 4.5],
      ['stateless', 'Skill summarize condensed 4 sources', 'summarize', 3.5],
      ['stateful', 'memory.write research/vector-db (6 notes)', 'memory', 3],
      ['planning', 'Drafting the comparison table', 'write_doc', 5],
    ]),
  },
  {
    id: 'pico', name: 'Pico', role: 'Ops agent', task: 'Free disk on staging',
    steps: steps([
      ['dispatch', 'Picked up alert: staging disk at 91%', 'read_ticket', 3],
      ['terminal', '$ du -sh /var/log/*   app.log 6.4G', 'bash', 4.5],
      ['stateful', 'session-browser opened the staging console', 'session-browser', 4],
      ['terminal', '$ logrotate -f /etc/logrotate.conf', 'bash', 4],
      ['archive', 'Archived 2.1 GB to logs/2026-11/', 'write_file', 3.5],
    ]),
  },
  {
    id: 'rook', name: 'Rook', role: 'Review agent', task: 'Review PR #91 (rate limiter)',
    steps: steps([
      ['dispatch', 'Picked up review: PR #91 adds a rate limiter', 'read_ticket', 3],
      ['archive', 'Reading middleware/ratelimit.go', 'read_file', 4.5],
      ['stateless', 'Skill lint found 3 warnings', 'lint', 3],
      ['editor', 'Comment on line 48: bucket never refills', 'comment', 5],
      ['stateful', 'tracker: PR #91 marked "changes requested"', 'tracker', 3],
    ]),
  },
  {
    id: 'vega', name: 'Vega', role: 'Planning agent', task: 'Plan sprint 14',
    steps: steps([
      ['dispatch', 'Picked up: plan sprint 14', 'read_ticket', 3],
      ['stateful', 'tracker loaded 23 open issues', 'tracker', 3.5],
      ['planning', 'Grouping issues into 4 themes', 'write_doc', 5],
      ['stateless', 'Skill pdf-extract read roadmap.pdf (12 pages)', 'pdf-extract', 3.5],
      ['planning', 'Writing sprint-14.md', 'write_file', 4.5],
      ['dispatch', 'Handed 5 tickets to Atlas and Rook', 'handoff', 3],
    ]),
  },
];

/** Team members who are not on the floor right now. */
export const OFF_FLOOR_AGENTS = [
  { id: 'orion', name: 'Orion', role: 'Coordinator agent', status: 'idle' as const, skills: ['tracker', 'memory', 'scheduler'], tools: ['read_ticket', 'handoff', 'write_doc'], last: 'Assigned 9 tickets for the morning shift', ago: '14 min ago' },
  { id: 'sable', name: 'Sable', role: 'Security review agent', status: 'idle' as const, skills: ['lint', 'repo-checkout', 'regex-extract'], tools: ['read_file', 'comment', 'bash'], last: 'Scanned PR #90 for leaked secrets', ago: '32 min ago' },
  { id: 'lumen', name: 'Lumen', role: 'Docs agent', status: 'offline' as const, skills: ['summarize', 'translate', 'pdf-extract'], tools: ['read_file', 'write_file', 'write_doc'], last: 'Published API docs v3.2', ago: 'yesterday, 17:40' },
  { id: 'nova', name: 'Nova', role: 'Data agent', status: 'idle' as const, skills: ['csv-parse', 'vector-index', 'kv-cache'], tools: ['bash', 'read_file', 'write_file'], last: 'Re-indexed the tickets collection', ago: '6 min ago' },
  { id: 'quill', name: 'Quill', role: 'Support triage agent', status: 'idle' as const, skills: ['summarize', 'memory', 'regex-extract'], tools: ['read_ticket', 'handoff'], last: 'Triaged 14 support emails', ago: '22 min ago' },
  { id: 'tern', name: 'Tern', role: 'QA agent', status: 'offline' as const, skills: ['test-runner', 'session-browser', 'image-resize'], tools: ['bash', 'web_fetch'], last: 'Ran the nightly end-to-end suite', ago: 'today, 02:10' },
];
