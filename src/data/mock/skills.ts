import type { Skill } from '../types';

type SkillSeed = Omit<Skill, 'id' | 'callsToday'>;

/** Every skill in the library. Order sets the rack order on the skills layer. */
const SEEDS: Record<string, SkillSeed> = {
  'test-runner': { kind: 'sl', desc: 'Runs one test file, returns failures', version: '1.4.0', runtime: '1 GPU slice · 4 GB', latency: '2.8 s', input: 'path: string, filter?: string', output: 'passed: int, failed: [{name, error}]', steps: ['Run one test file in a fresh sandbox', 'Parse the runner output (jest, pytest, go test)', 'Return only the failing cases with their first error line'], files: [['parsers/jest.js', '3.4 KB'], ['parsers/pytest.py', '2.9 KB'], ['run.sh', '0.8 KB']] },
  summarize: { kind: 'sl', desc: 'Condenses sources into notes', version: '2.0.1', runtime: '2 GPU slices · 16 GB', latency: '4.1 s', input: 'sources: [text], max_words?: int', output: 'notes: markdown with source refs', steps: ['Split each source into chunks', 'Pull the key claims, keeping a reference to the source', 'Merge them into one bulleted summary'], files: [['prompts/condense.md', '1.6 KB'], ['chunker.py', '2.2 KB']] },
  lint: { kind: 'sl', desc: 'Static checks on a diff', version: '0.9.3', runtime: 'CPU · 1 GB', latency: '0.6 s', input: 'diff: unified patch', output: 'warnings: [{file, line, rule, message}]', steps: ['Apply the patch to a scratch copy', 'Run language linters on changed lines only', 'Group warnings by file'], files: [['rules.yaml', '4.0 KB'], ['run.py', '1.9 KB']] },
  'pdf-extract': { kind: 'sl', desc: 'Text and tables from a PDF', version: '1.2.0', runtime: '1 GPU slice · 8 GB', latency: '3.5 s', input: 'file: pdf, pages?: range', output: 'text: string, tables: [csv]', steps: ['Render each page', 'Detect tables and read them into CSV', 'Return plain text with page markers'], files: [['ocr.py', '5.1 KB'], ['tables.py', '3.3 KB']] },
  memory: { kind: 'sf', desc: 'Long-term notes', state: '128 notes kept', fill: 0.62, version: '4.0.2', runtime: '1 GPU slice · 8 GB + store', latency: '0.3 s', input: 'op: read | write | search, key: path, value?: text', output: 'notes: [note]', steps: ['Look up the key in the state store', 'Read, append or search notes under it', 'Write changes back before returning'], files: [['store.py', '3.8 KB'], ['search.py', '2.0 KB']],
    stateTable: { head: ['Key', 'Notes', 'Updated'], rows: [['research/vector-db', '6', '2 min ago'], ['ops/staging', '12', '1 h ago'], ['team/code-style', '31', '3 days ago'], ['customers/acme', '47', '5 days ago'], ['incidents/2026-11', '9', '1 week ago']] } },
  'session-browser': { kind: 'sf', desc: 'Browser with saved sign-ins', state: '2 sites signed in', fill: 0.3, version: '1.6.0', runtime: '1 GPU slice · 4 GB + store', latency: '5.2 s', input: 'url: string, action?: click | fill | read', output: 'page: text, screenshot?: png', steps: ['Load the saved sign-in for the site', 'Open the page and perform the action', 'Save the refreshed session before returning'], files: [['browser.py', '6.7 KB'], ['cookies.enc', 'encrypted']],
    stateTable: { head: ['Site', 'Session', 'Expires'], rows: [['staging.console', 'signed in', 'in 4 h'], ['github.com', 'signed in', 'in 6 days']] } },
  tracker: { kind: 'sf', desc: 'Issue tracker cursor', state: '23 open issues', fill: 0.45, version: '2.3.1', runtime: 'CPU · 1 GB + store', latency: '0.5 s', input: 'op: list | get | update, issue?: id, status?: text', output: 'issues: [issue]', steps: ['Read the cached issue list', 'Apply the update and sync to the tracker', 'Store the new cursor'], files: [['sync.py', '2.6 KB']],
    stateTable: { head: ['Issue', 'Status', 'Owner'], rows: [['#482 checkout test failing', 'in progress', 'Atlas'], ['#91 rate limiter', 'changes requested', 'Rook'], ['#477 flaky e2e on CI', 'open', 'none'], ['#470 staging disk alerts', 'in progress', 'Pico'], ['#466 sprint 14 plan', 'in progress', 'Vega']] } },
  translate: { kind: 'sl', desc: 'Text between 40 languages', version: '3.1.0', runtime: '1 GPU slice · 8 GB', latency: '1.2 s', input: 'text: string, to: language code', output: 'text: string', steps: ['Detect the source language', 'Translate, keeping code blocks unchanged'], files: [['glossary.csv', '12 KB']] },
  'csv-parse': { kind: 'sl', desc: 'CSV into typed rows', version: '1.0.4', runtime: 'CPU · 512 MB', latency: '0.2 s', input: 'csv: text, schema?: json', output: 'rows: [object], errors: [row]', steps: ['Sniff the delimiter and header', 'Cast columns to the schema types', 'Report rows that fail to parse'], files: [['parse.py', '2.4 KB']] },
  'image-resize': { kind: 'sl', desc: 'Resize and convert images', version: '2.2.0', runtime: '1 GPU slice · 2 GB', latency: '0.4 s', input: 'image: file, width: int, format?: png|webp|jpg', output: 'image: file', steps: ['Decode the image', 'Resize, keeping the aspect ratio', 'Encode to the requested format'], files: [['resize.py', '1.1 KB']] },
  'regex-extract': { kind: 'sl', desc: 'Pattern matches from text', version: '1.1.0', runtime: 'CPU · 256 MB', latency: '0.1 s', input: 'text: string, pattern: regex', output: 'matches: [string]', steps: ['Compile the pattern with a time limit', 'Return every match in order'], files: [['extract.py', '0.9 KB']] },
  'vector-index': { kind: 'sf', desc: 'Embeddings index', state: '1.2M vectors', fill: 0.81, version: '1.8.0', runtime: '2 GPU slices · 24 GB + store', latency: '0.09 s', input: 'op: upsert | query, text: string, k?: int', output: 'hits: [{id, score}]', steps: ['Embed the text', 'Upsert it or run a nearest-neighbour query', 'Return ids with scores'], files: [['embed.py', '1.7 KB'], ['index.faiss', '2.1 GB']],
    stateTable: { head: ['Collection', 'Vectors', 'Updated'], rows: [['docs-main', '820k', '1 h ago'], ['tickets', '310k', '5 min ago'], ['code', '70k', '1 day ago']] } },
  'kv-cache': { kind: 'sf', desc: 'Key-value cache', state: '84k keys', fill: 0.55, version: '1.0.0', runtime: 'CPU · 4 GB + store', latency: '0.01 s', input: 'op: get | set, key: string, value?: any, ttl?: duration', output: 'value | null', steps: ['Hash the key', 'Get or set it with its TTL'], files: [['cache.py', '0.8 KB']],
    stateTable: { head: ['Prefix', 'Keys', 'TTL'], rows: [['web_fetch:*', '61k', '24 h'], ['embeddings:*', '23k', '7 days']] } },
  scheduler: { kind: 'sf', desc: 'Timers and cron jobs', state: '17 jobs queued', fill: 0.2, version: '0.7.2', runtime: 'CPU · 512 MB + store', latency: '0.05 s', input: 'op: add | cancel | list, cron?: text, task?: text', output: 'jobs: [job]', steps: ['Validate the schedule', 'Store the job and its next run time'], files: [['cron.py', '1.4 KB']],
    stateTable: { head: ['Job', 'Schedule', 'Next run'], rows: [['nightly-backup', '02:00 daily', 'in 16 h'], ['rotate-staging-logs', 'every 6 h', 'in 2 h'], ['weekly-report', 'Mon 08:00', 'in 3 days']] } },
  'repo-checkout': { kind: 'sf', desc: 'Working copies of repos', state: '6 repos cloned', fill: 0.7, version: '1.3.0', runtime: 'CPU · 2 GB + store', latency: '1.9 s', input: 'repo: name, ref?: branch | sha', output: 'path: string, status: text', steps: ['Reuse the existing working copy if there is one', 'Fetch and check out the ref', 'Return the path and git status'], files: [['checkout.sh', '1.2 KB']],
    stateTable: { head: ['Repo', 'Ref', 'Status'], rows: [['shop-web', 'main @ 4f2c1a', 'clean'], ['api', 'pr-91 @ 9b0e33', '2 files changed'], ['infra', 'main @ 77d1e0', 'clean']] } },
};

/** Deterministic "calls earlier today" numbers, stateless racks first. */
function seedCalls(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  let s = 7;
  for (const k of ids) {
    s = (s * 9301 + 49297) % 233280;
    out[k] = 40 + Math.floor((s / 233280) * 360);
  }
  return out;
}

const ids = Object.keys(SEEDS);
const calls = seedCalls([...ids.filter((k) => SEEDS[k].kind === 'sl'), ...ids.filter((k) => SEEDS[k].kind === 'sf')]);

export const SKILLS: Record<string, Skill> = Object.fromEntries(
  ids.map((id) => [id, { id, callsToday: calls[id], ...SEEDS[id] }]),
);
