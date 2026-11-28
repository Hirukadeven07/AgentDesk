import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { windsurf } from './windsurf';

const md = (frontmatter: string, body: string) => `---\n${frontmatter}\n---\n${body}\n`;

const project = memoryTree({
  '.windsurfrules': 'Keep functions small.\n',
  '.windsurf/rules/style.md': md('trigger: always_on', 'Use tabs.'),
  '.windsurf/rules/tests.md': md('trigger: glob\nglobs: *.test.ts', 'Use vitest.'),
  '.windsurf/rules/db.md': md('trigger: model_decision\ndescription: When touching the database', 'Use migrations.'),
  '.windsurf/rules/release.md': md('trigger: manual', 'Bump the version.'),
  'packages/ui/.windsurf/rules/ui.md': md('trigger: always_on', 'UI only.'),
  '.windsurf/workflows/deploy.md': md('description: Deploy to staging', '1. Build\n2. Ship'),
  '.windsurf/workflows/triage.md': 'Label new issues.\n',
});

describe('windsurf adapter', () => {
  it('detects a .windsurf folder or .windsurfrules', () => {
    expect(windsurf.detect(memoryTree({ '.windsurfrules': '' }))).toBe(true);
    expect(windsurf.detect(memoryTree({ '.windsurf/rules/a.md': '' }))).toBe(true);
    expect(windsurf.detect(memoryTree({ '.cursorrules': '' }))).toBe(false);
  });

  it('gives the primary agent .windsurfrules and the always-on rules at the root', async () => {
    const { agents } = await windsurf.parse(project);
    expect(agents).toEqual([
      {
        id: 'windsurf',
        name: 'Windsurf',
        kind: 'primary',
        description: 'The main Windsurf (Cascade) agent for this project.',
        instructions: 'Keep functions small.\n\n# style (.windsurf/rules/style.md)\n\nUse tabs.\n',
        tools: [],
        skills: [],
        origin: { platform: 'windsurf', path: '.windsurfrules' },
      },
    ]);
  });

  it('shows other rules as skills, described by their trigger, and workflows as skills', async () => {
    const { skills, warnings } = await windsurf.parse(project);
    expect(skills.map((s) => [s.id, s.description, s.origin.path])).toEqual([
      ['db', 'When touching the database', '.windsurf/rules/db.md'],
      ['release', 'Applied when mentioned as @release', '.windsurf/rules/release.md'],
      ['tests', 'Applies to *.test.ts', '.windsurf/rules/tests.md'],
      ['ui', 'Always applies in packages/ui/', 'packages/ui/.windsurf/rules/ui.md'],
      ['deploy', 'Deploy to staging', '.windsurf/workflows/deploy.md'],
      ['triage', 'Label new issues.', '.windsurf/workflows/triage.md'],
    ]);
    // `globs: *.test.ts` is not valid YAML; Windsurf reads it as text, and so do we
    expect(warnings).toEqual([]);
  });

  it('has a primary agent with no instructions when nothing is always on', async () => {
    const { agents } = await windsurf.parse(memoryTree({ '.windsurf/workflows/a.md': 'Do a.' }));
    expect(agents[0].instructions).toBeUndefined();
    expect(agents[0].origin.path).toBe('.windsurf/workflows/a.md');
  });
});
