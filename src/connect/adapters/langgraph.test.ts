import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { graphSource, langgraph } from './langgraph';

const pythonGraph = `"""A research agent that searches the web and writes a summary.

It loops until it has enough sources.
"""
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END


@tool
def web_search(query: str) -> str:
    """Search the web."""


@tool("fetch_page", return_direct=False)
async def fetch(url: str) -> str:
    """Fetch a page."""


builder = StateGraph(State)
builder.add_node("plan", plan)
builder.add_node('search', search)
builder.add_node("write_summary", write)
builder.add_edge(START, "plan")
graph = builder.compile()
`;

const jsGraph = `/**
 * Answers support tickets.
 */
const workflow = new StateGraph(State)
  .addNode("classify", classify)
  .addNode('reply', reply);
export const graph = workflow.compile();
`;

const project = memoryTree({
  'langgraph.json': JSON.stringify({
    dependencies: ['.'],
    graphs: {
      researcher: './src/agent/graph.py:graph',
      support: { path: './src/support.ts:graph', description: 'Customer support agent' },
      missing: './src/nowhere.py:graph',
    },
    env: '.env',
  }),
  'src/agent/graph.py': pythonGraph,
  'src/support.ts': jsGraph,
});

describe('graphSource', () => {
  it('reads the docstring, nodes and @tool functions of a Python graph', () => {
    expect(graphSource(pythonGraph)).toEqual({
      doc: 'A research agent that searches the web and writes a summary.',
      nodes: ['plan', 'search', 'write_summary'],
      tools: ['web_search', 'fetch_page'],
    });
  });

  it('names a node added as a function after the function, as LangGraph does', () => {
    // from langchain-ai/react-agent's graph.py
    const src = 'builder = StateGraph(State)\nbuilder.add_node(call_model)\nbuilder.add_node("tools", ToolNode(TOOLS))\n';
    expect(graphSource(src).nodes).toEqual(['call_model', 'tools']);
  });

  it('reads the leading comment and addNode calls of a JS graph', () => {
    expect(graphSource(jsGraph)).toEqual({ doc: 'Answers support tickets.', nodes: ['classify', 'reply'], tools: [] });
  });
});

describe('langgraph adapter', () => {
  it('detects langgraph.json', () => {
    expect(langgraph.detect(project)).toBe(true);
    expect(langgraph.detect(memoryTree({ 'graph.py': '' }))).toBe(false);
  });

  it('reads each graph as an agent, with its nodes and tools', async () => {
    const { agents, warnings } = await langgraph.parse(project);
    expect(agents).toEqual([
      {
        id: 'researcher',
        name: 'researcher',
        kind: 'custom',
        description: 'A research agent that searches the web and writes a summary.',
        instructions: 'Graph nodes: plan → search → write_summary\n',
        tools: ['web_search', 'fetch_page'],
        skills: [],
        origin: { platform: 'langgraph', path: 'src/agent/graph.py' },
      },
      {
        id: 'support',
        name: 'support',
        kind: 'custom',
        description: 'Customer support agent',
        instructions: 'Graph nodes: classify → reply\n',
        tools: [],
        skills: [],
        origin: { platform: 'langgraph', path: 'src/support.ts' },
      },
      {
        id: 'missing',
        name: 'missing',
        kind: 'custom',
        tools: [],
        skills: [],
        origin: { platform: 'langgraph', path: 'langgraph.json' },
      },
    ]);
    expect(warnings).toEqual(['langgraph.json: graph "missing" points at src/nowhere.py, which is not in the project']);
  });

  it('names graphs after their folder when a monorepo has several langgraph.json files', async () => {
    const { agents } = await langgraph.parse(memoryTree({
      'apps/sales/langgraph.json': JSON.stringify({ graphs: { agent: './agent.py:graph' } }),
      'apps/sales/agent.py': '',
      'apps/support/langgraph.json': JSON.stringify({ graphs: { agent: './agent.py:graph' } }),
      'apps/support/agent.py': '',
    }));
    expect(agents.map((a) => [a.id, a.origin.path])).toEqual([
      ['sales:agent', 'apps/sales/agent.py'],
      ['support:agent', 'apps/support/agent.py'],
    ]);
  });

  it('warns about a langgraph.json that is not valid JSON or has no graphs', async () => {
    expect((await langgraph.parse(memoryTree({ 'langgraph.json': '{' }))).warnings).toEqual(['langgraph.json is not valid JSON']);
    expect((await langgraph.parse(memoryTree({ 'langgraph.json': '{"dependencies": ["."]}' }))).warnings).toEqual(['langgraph.json has no graphs']);
  });
});
