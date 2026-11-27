import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { agentSkills, skillPlatform } from './agentSkills';

const skill = (name: string, description: string, body = 'Do the thing.') => `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

describe('skillPlatform', () => {
  it('names the platform from the folder the skill sits in', () => {
    expect(skillPlatform('.claude/skills/pr/SKILL.md', [])).toBe('claude-code');
    expect(skillPlatform('.agents/skills/pr/SKILL.md', [])).toBe('agent-skills');
    expect(skillPlatform('.codex/skills/pr/SKILL.md', [])).toBe('codex');
    expect(skillPlatform('.cursor/skills/pr/SKILL.md', [])).toBe('cursor');
    expect(skillPlatform('.github/skills/pr/SKILL.md', [])).toBe('copilot');
    expect(skillPlatform('.gemini/skills/pr/SKILL.md', [])).toBe('gemini-cli');
    expect(skillPlatform('.windsurf/skills/pr/SKILL.md', [])).toBe('windsurf');
  });

  it('works for platform folders inside a subproject', () => {
    expect(skillPlatform('apps/web/.claude/skills/pr/SKILL.md', [])).toBe('claude-code');
  });

  it('gives a Claude Code plugin skill to Claude Code', () => {
    const paths = ['plugins/review/.claude-plugin/plugin.json', 'plugins/review/skills/lint/SKILL.md'];
    expect(skillPlatform('plugins/review/skills/lint/SKILL.md', paths)).toBe('claude-code');
  });

  it('falls back to the shared format for any other skills folder', () => {
    expect(skillPlatform('skills/pr/SKILL.md', [])).toBe('agent-skills');
  });
});

describe('agentSkills adapter', () => {
  it('detects a tree with any SKILL.md', () => {
    expect(agentSkills.detect(memoryTree({ 'x/SKILL.md': '' }))).toBe(true);
    expect(agentSkills.detect(memoryTree({ 'README.md': '' }))).toBe(false);
  });

  it('reads name, description, body, files and origin', async () => {
    const tree = memoryTree({
      '.claude/skills/pr/SKILL.md': skill('pr', 'Use when writing a PR body.', 'Use this template.'),
      '.claude/skills/pr/LICENSE': 'MIT',
      '.claude/skills/pr/agents/openai.yaml': 'interface:\n  display_name: "PR"\n',
    });
    const { skills, warnings } = await agentSkills.parse(tree);
    expect(warnings).toEqual([]);
    expect(skills).toEqual([
      {
        id: 'pr',
        description: 'Use when writing a PR body.',
        instructions: 'Use this template.\n',
        files: [{ path: 'LICENSE' }, { path: 'agents/openai.yaml' }],
        origin: { platform: 'claude-code', path: '.claude/skills/pr/SKILL.md' },
      },
    ]);
  });

  it('finds skills for every platform in one tree', async () => {
    const tree = memoryTree({
      '.claude/skills/a/SKILL.md': skill('a', 'A'),
      '.agents/skills/b/SKILL.md': skill('b', 'B'),
      '.cursor/skills/c/SKILL.md': skill('c', 'C'),
      '.github/skills/d/SKILL.md': skill('d', 'D'),
    });
    const { skills } = await agentSkills.parse(tree);
    expect(skills.map((s) => [s.id, s.origin.platform])).toEqual([
      ['b', 'agent-skills'],
      ['a', 'claude-code'],
      ['c', 'cursor'],
      ['d', 'copilot'],
    ]);
  });

  it('uses the folder name when the frontmatter has no name', async () => {
    const { skills } = await agentSkills.parse(memoryTree({ '.claude/skills/deploy/SKILL.md': '---\ndescription: Ship it\n---\nSteps' }));
    expect(skills[0].id).toBe('deploy');
  });

  it('reads a repo whose root is one skill', async () => {
    const tree = memoryTree({ 'SKILL.md': '---\ndescription: A skill repo\n---\nBody', 'scripts/run.sh': 's' });
    const { skills } = await agentSkills.parse(tree);
    expect(skills).toMatchObject([{ id: 'skill', files: [{ path: 'scripts/run.sh' }], origin: { platform: 'agent-skills', path: 'SKILL.md' } }]);
  });

  it("uses Codex's short_description when SKILL.md has no description", async () => {
    const tree = memoryTree({
      '.agents/skills/pr/SKILL.md': '---\nname: pr\n---\nBody',
      '.agents/skills/pr/agents/openai.yaml': 'interface:\n  display_name: "PR"\n  short_description: "Write a PR body that\'s fast to review"\n',
    });
    const { skills, warnings } = await agentSkills.parse(tree);
    expect(skills[0].description).toBe("Write a PR body that's fast to review");
    expect(warnings).toEqual([]);
  });

  it('keeps a skill with no description but warns about it', async () => {
    const { skills, warnings } = await agentSkills.parse(memoryTree({ '.claude/skills/x/SKILL.md': 'Just a body' }));
    expect(skills).toHaveLength(1);
    expect(skills[0].description).toBe('');
    expect(warnings).toEqual(['.claude/skills/x/SKILL.md has no description']);
  });

  it('warns about broken frontmatter and still keeps the skill', async () => {
    const { skills, warnings } = await agentSkills.parse(memoryTree({ '.claude/skills/x/SKILL.md': '---\nname: [oops\n---\nBody' }));
    expect(skills[0].id).toBe('x');
    expect(warnings[0]).toMatch(/^\.claude\/skills\/x\/SKILL\.md has invalid frontmatter/);
  });

  it('skips a SKILL.md it cannot read and says so', async () => {
    const { skills, warnings } = await agentSkills.parse(memoryTree({ '.claude/skills/big/SKILL.md': 'x'.repeat(300 * 1024) }));
    expect(skills).toEqual([]);
    expect(warnings).toEqual(['.claude/skills/big/SKILL.md could not be read (missing or over 256 KB)']);
  });

  it("does not list a nested skill's files as files of the skill around it", async () => {
    const tree = memoryTree({
      'skills/outer/SKILL.md': skill('outer', 'Outer'),
      'skills/outer/notes.md': 'n',
      'skills/outer/inner/SKILL.md': skill('inner', 'Inner'),
      'skills/outer/inner/run.sh': 's',
    });
    const { skills } = await agentSkills.parse(tree);
    const outer = skills.find((s) => s.id === 'outer')!;
    const inner = skills.find((s) => s.id === 'inner')!;
    expect(outer.files).toEqual([{ path: 'notes.md' }]);
    expect(inner.files).toEqual([{ path: 'run.sh' }]);
  });
});
