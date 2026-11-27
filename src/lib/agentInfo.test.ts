import { describe, expect, it } from 'vitest';
import { shortTool } from './agentInfo';

describe('shortTool', () => {
  it('turns underscores into spaces', () => {
    expect(shortTool('read_file')).toBe('read file');
    expect(shortTool('web_search_news')).toBe('web search news');
  });

  it('collapses runs of underscores in MCP-style names', () => {
    expect(shortTool('mcp__github__create_pull_request')).toBe('mcp github create pull request');
  });

  it('leaves names without underscores alone', () => {
    expect(shortTool('bash')).toBe('bash');
    expect(shortTool('test-runner')).toBe('test-runner');
  });
});
