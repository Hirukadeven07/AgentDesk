import type { PlatformId } from '../data/types';

/** How each platform is named in the app. */
export const PLATFORM_LABELS: Record<PlatformId, string> = {
  'agent-skills': 'Agent Skills',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  copilot: 'GitHub Copilot',
  'gemini-cli': 'Gemini CLI',
  windsurf: 'Windsurf',
  cline: 'Cline',
  'roo-code': 'Roo Code',
  crewai: 'CrewAI',
  langgraph: 'LangGraph',
  manifest: 'Manifest',
};
