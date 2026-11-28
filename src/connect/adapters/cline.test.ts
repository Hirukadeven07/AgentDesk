import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { cline } from './cline';

describe('cline adapter', () => {
  it('detects .clinerules as a file or a folder, or .cline/rules', () => {
    expect(cline.detect(memoryTree({ '.clinerules': 'x' }))).toBe(true);
    expect(cline.detect(memoryTree({ '.clinerules/01-style.md': 'x' }))).toBe(true);
    expect(cline.detect(memoryTree({ '.cline/rules/a.md': 'x' }))).toBe(true);
    expect(cline.detect(memoryTree({ '.cursorrules': 'x' }))).toBe(false);
  });

  it('uses a single .clinerules file as the primary agent instructions', async () => {
    const { agents } = await cline.parse(memoryTree({ '.clinerules': 'Always run the linter.\n' }));
    expect(agents).toEqual([
      {
        id: 'cline',
        name: 'Cline',
        kind: 'primary',
        description: 'The main Cline agent for this project.',
        instructions: 'Always run the linter.\n',
        tools: [],
        skills: [],
        origin: { platform: 'cline', path: '.clinerules' },
      },
    ]);
  });

  describe('a .clinerules folder', () => {
    const project = memoryTree({
      '.clinerules/01-coding.md': 'Use strict TypeScript.\n',
      '.clinerules/02-testing.md': '# Testing\n\nWrite a test first.\n',
      '.clinerules/frontend.md': '---\npaths:\n  - "src/components/**"\n  - "src/pages/**"\n---\nUse the design system.\n',
      '.clinerules/workflows/release.md': '# Cut a release\n\n1. Bump the version\n2. Tag it\n',
      '.clinerules/workflows/pr-review.md': 'Review the open pull request.\n',
      '.cline/rules/docs.md': 'Keep the docs short.\n',
    });

    it('joins rules without paths, in file order, as the primary agent instructions', async () => {
      const { agents } = await cline.parse(project);
      expect(agents[0].instructions).toBe(
        '# docs (.cline/rules/docs.md)\n\nKeep the docs short.\n\n' +
          '# 01-coding (.clinerules/01-coding.md)\n\nUse strict TypeScript.\n\n' +
          '# 02-testing (.clinerules/02-testing.md)\n\n# Testing\n\nWrite a test first.\n',
      );
      expect(agents[0].origin.path).toBe('.cline/rules/docs.md');
    });

    it('shows rules limited to some paths, and workflows, as skills', async () => {
      const { skills } = await cline.parse(project);
      expect(skills.map((s) => [s.id, s.description, s.origin.path])).toEqual([
        ['frontend', 'Applies to src/components/**, src/pages/**', '.clinerules/frontend.md'],
        ['pr-review', 'Review the open pull request.', '.clinerules/workflows/pr-review.md'],
        ['release', 'Cut a release', '.clinerules/workflows/release.md'],
      ]);
      expect(skills[2].instructions).toBe('# Cut a release\n\n1. Bump the version\n2. Tag it\n');
    });
  });

  it('skips the hooks folder, which holds hook scripts and their notes, not rules', async () => {
    const { agents } = await cline.parse(memoryTree({ '.clinerules/general.md': 'Be brief.', '.clinerules/hooks/README.md': 'How our hooks work.' }));
    expect(agents[0].instructions).toBe('# general (.clinerules/general.md)\n\nBe brief.');
  });

  it('treats a rule with broken frontmatter as always on, as Cline does, and warns', async () => {
    const { agents, warnings } = await cline.parse(memoryTree({ '.clinerules/x.md': '---\npaths: [oops\n---\nBody\n' }));
    expect(agents[0].instructions).toBe('# x (.clinerules/x.md)\n\nBody\n');
    expect(warnings).toEqual([expect.stringMatching(/^\.clinerules\/x\.md has invalid frontmatter/)]);
  });

  it('has no MCP servers, because Cline keeps them in user settings', async () => {
    const { mcpServers } = await cline.parse(memoryTree({ '.clinerules': 'x' }));
    expect(mcpServers).toEqual([]);
  });
});
