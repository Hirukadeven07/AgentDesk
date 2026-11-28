import type { Adapter } from '../types';
import { agentSkills } from './agentSkills';
import { claudeCode } from './claudeCode';
import { cline } from './cline';
import { codex } from './codex';
import { copilot } from './copilot';
import { crewai } from './crewai';
import { cursor } from './cursor';
import { geminiCli } from './geminiCli';
import { langgraph } from './langgraph';
import { manifest } from './manifest';
import { rooCode } from './rooCode';
import { windsurf } from './windsurf';

/**
 * Every adapter, in the order their findings are merged. Coding tools come first so their main
 * agents lead the roster; shared SKILL.md skills come after the tools that own skill folders.
 * Adding a platform means adding its adapter here.
 */
export const ADAPTERS: Adapter[] = [claudeCode, codex, cursor, copilot, geminiCli, windsurf, cline, rooCode, agentSkills, crewai, langgraph, manifest];
