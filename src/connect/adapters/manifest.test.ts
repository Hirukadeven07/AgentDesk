import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import manifestDoc from '../../../docs/manifest.md?raw';
import schemaText from '../../../public/agentsdeck.schema.json?raw';
import { manifest } from './manifest';

const doc = (json: unknown) => memoryTree({ 'agentsdeck.json': JSON.stringify(json) });

describe('manifest adapter', () => {
  it('detects agentsdeck.json anywhere', () => {
    expect(manifest.detect(memoryTree({ 'agentsdeck.json': '{}' }))).toBe(true);
    expect(manifest.detect(memoryTree({ 'infra/agentsdeck.json': '{}' }))).toBe(true);
    expect(manifest.detect(memoryTree({ 'package.json': '{}' }))).toBe(false);
  });

  it('reads agents, skills and MCP servers', async () => {
    const d = await manifest.parse(doc({
      version: 1,
      agents: [
        { id: 'support-bot', name: 'Support Bot', kind: 'primary', description: 'Answers tickets.', provider: 'Amazon Bedrock', model: 'm', tools: ['refund'], skills: ['refund-policy'], instructions: 'Be kind.' },
        { id: 'triage' },
      ],
      skills: [{ id: 'refund-policy', description: 'Decides refunds.', instructions: 'Within 30 days.' }],
      mcpServers: ['orders-db'],
    }));
    expect(d.warnings).toEqual([]);
    expect(d.agents).toEqual([
      {
        id: 'support-bot',
        name: 'Support Bot',
        kind: 'primary',
        description: 'Answers tickets. Runs on Amazon Bedrock.',
        instructions: 'Be kind.',
        model: 'm',
        tools: ['refund'],
        skills: ['refund-policy'],
        origin: { platform: 'manifest', path: 'agentsdeck.json' },
      },
      { id: 'triage', name: 'triage', kind: 'custom', tools: [], skills: [], origin: { platform: 'manifest', path: 'agentsdeck.json' } },
    ]);
    expect(d.skills).toEqual([
      { id: 'refund-policy', description: 'Decides refunds.', instructions: 'Within 30 days.', files: [], origin: { platform: 'manifest', path: 'agentsdeck.json' } },
    ]);
    expect(d.mcpServers).toEqual([{ name: 'orders-db', origin: { platform: 'manifest', path: 'agentsdeck.json' } }]);
  });

  it('shows the provider on its own when there is no description', async () => {
    const d = await manifest.parse(doc({ version: 1, agents: [{ id: 'a', provider: 'n8n' }] }));
    expect(d.agents[0].description).toBe('Runs on n8n.');
  });

  it('warns about every problem the docs list, and keeps everything else', async () => {
    const d = await manifest.parse(doc({
      version: 2,
      agents: [{ id: 'a' }, { id: 'a' }, { name: 'no id' }, 'not an object'],
      skills: [{ id: 's' }, { description: 'no id' }],
      mcpServers: ['ok', 3],
    }));
    expect(d.agents.map((a) => a.id)).toEqual(['a']);
    expect(d.skills.map((s) => s.id)).toEqual(['s']);
    expect(d.mcpServers.map((m) => m.name)).toEqual(['ok']);
    expect(d.warnings).toEqual([
      'agentsdeck.json: version should be 1',
      'agentsdeck.json: agent "a" appears more than once',
      'agentsdeck.json: agent 3 has no id',
      'agentsdeck.json: agent 4 is not an object',
      'agentsdeck.json: skill "s" has no description',
      'agentsdeck.json: skill 2 has no id',
      'agentsdeck.json: mcpServers 2 is not a name',
    ]);
  });

  it('warns about a file that is not JSON', async () => {
    expect((await manifest.parse(memoryTree({ 'agentsdeck.json': '{' }))).warnings).toEqual(['agentsdeck.json is not valid JSON']);
  });

  it('reads the example in docs/manifest.md without warnings', async () => {
    const example = /```json\n([\s\S]*?)\n```/.exec(manifestDoc.replace(/\r\n/g, '\n'))![1];
    const d = await manifest.parse(memoryTree({ 'agentsdeck.json': example }));
    expect(d.warnings).toEqual([]);
    expect(d.agents.map((a) => a.id)).toEqual(['support-bot']);
  });

  it('matches the published JSON Schema: same fields, same required ones', () => {
    const schema = JSON.parse(schemaText);
    expect(Object.keys(schema.properties)).toEqual(['$schema', 'version', 'agents', 'skills', 'mcpServers']);
    expect(Object.keys(schema.$defs.agent.properties)).toEqual(['id', 'name', 'kind', 'description', 'instructions', 'model', 'provider', 'tools', 'skills']);
    expect(schema.$defs.agent.required).toEqual(['id']);
    expect(Object.keys(schema.$defs.skill.properties)).toEqual(['id', 'description', 'instructions']);
    expect(schema.$defs.skill.required).toEqual(['id', 'description']);
  });
});
