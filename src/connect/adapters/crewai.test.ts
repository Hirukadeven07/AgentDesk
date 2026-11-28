import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { crewai } from './crewai';

const agentsYaml = `researcher:
  role: >
    {topic} Senior Data Researcher
  goal: >
    Uncover cutting-edge developments in {topic}
  backstory: >
    You're a seasoned researcher.
  llm: openai/gpt-5.5

reporting_analyst:
  role: >
    {topic} Reporting Analyst
  goal: Create detailed reports
  backstory: You're meticulous.
  tools:
    - SerperDevTool
`;

const tasksYaml = `research_task:
  description: >
    Conduct a thorough research about {topic}.
    Make sure you find any interesting and relevant information.
  expected_output: >
    A list with 10 bullet points of the most relevant information about {topic}
  agent: researcher

reporting_task:
  description: Review the context and expand each topic into a full section.
  expected_output: A fully fledged report in markdown.
  agent: reporting_analyst
  output_file: report.md
`;

const crew = memoryTree({
  'pyproject.toml': '[project]\nname = "latest_ai"\ndependencies = ["crewai[tools]>=1.0"]\n',
  'src/latest_ai/config/agents.yaml': agentsYaml,
  'src/latest_ai/config/tasks.yaml': tasksYaml,
  'src/latest_ai/crew.py': 'from crewai import Agent',
  'src/latest_ai/main.py': '',
});

describe('crewai adapter', () => {
  it('detects config/agents.yaml next to tasks.yaml or a crew.py, and nothing else', () => {
    expect(crewai.detect(crew)).toBe(true);
    expect(crewai.detect(memoryTree({ 'x/config/agents.yaml': '', 'x/crew.py': '' }))).toBe(true);
    expect(crewai.detect(memoryTree({ 'config/agents.yaml': 'a: 1' }))).toBe(false);
  });

  it('reads each agent with its role, goal and backstory, model and tools', async () => {
    const { agents } = await crewai.parse(crew);
    expect(agents).toEqual([
      {
        id: 'researcher',
        name: 'researcher',
        kind: 'custom',
        description: '{topic} Senior Data Researcher',
        instructions: 'Role: {topic} Senior Data Researcher\n\nGoal: Uncover cutting-edge developments in {topic}\n\nBackstory: You\'re a seasoned researcher.\n',
        model: 'openai/gpt-5.5',
        tools: [],
        skills: ['research_task'],
        origin: { platform: 'crewai', path: 'src/latest_ai/config/agents.yaml' },
      },
      {
        id: 'reporting_analyst',
        name: 'reporting_analyst',
        kind: 'custom',
        description: '{topic} Reporting Analyst',
        instructions: "Role: {topic} Reporting Analyst\n\nGoal: Create detailed reports\n\nBackstory: You're meticulous.\n",
        tools: ['SerperDevTool'],
        skills: ['reporting_task'],
        origin: { platform: 'crewai', path: 'src/latest_ai/config/agents.yaml' },
      },
    ]);
  });

  it('reads tasks as skills, with the expected output in the instructions', async () => {
    const { skills } = await crewai.parse(crew);
    expect(skills.map((s) => [s.id, s.description])).toEqual([
      ['research_task', 'Conduct a thorough research about {topic}.'],
      ['reporting_task', 'Review the context and expand each topic into a full section.'],
    ]);
    expect(skills[0]).toMatchObject({
      instructions:
        'Conduct a thorough research about {topic}. Make sure you find any interesting and relevant information.\n\n' +
        'Expected output: A list with 10 bullet points of the most relevant information about {topic}\n',
      origin: { platform: 'crewai', path: 'src/latest_ai/config/tasks.yaml' },
    });
  });

  it("links a task to its agent from crew.py when tasks.yaml doesn't say", async () => {
    // the pattern from crewAI-examples' game-builder crew
    const crewPy = `@CrewBase
class GameBuilderCrew:
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def senior_engineer_agent(self) -> Agent:
        return Agent(config=self.agents_config['senior_engineer_agent'])

    @agent
    def qa_engineer_agent(self) -> Agent:
        return Agent(config=self.agents_config['qa_engineer_agent'])

    @task
    def code_task(self) -> Task:
        return Task(
            config=self.tasks_config['code_task'],
            agent=self.senior_engineer_agent()
        )

    @task
    def review_task(self) -> Task:
        return Task(
            config=self.tasks_config["review_task"],
            agent = self.qa_engineer_agent(),
        )

    @task
    def unassigned_task(self) -> Task:
        return Task(config=self.tasks_config['unassigned_task'])
`;
    const { agents, warnings } = await crewai.parse(memoryTree({
      'src/game/config/agents.yaml': 'senior_engineer_agent:\n  role: Engineer\nqa_engineer_agent:\n  role: QA\n',
      'src/game/config/tasks.yaml': 'code_task:\n  description: Code it\nreview_task:\n  description: Review it\nunassigned_task:\n  description: Later\n',
      'src/game/crew.py': crewPy,
    }));
    expect(agents.map((a) => [a.id, a.skills])).toEqual([
      ['senior_engineer_agent', ['code_task']],
      ['qa_engineer_agent', ['review_task']],
    ]);
    expect(warnings).toEqual([]);
  });

  it('follows an agent method whose name differs from its agents.yaml key', async () => {
    // the pattern from crewAI-examples' landing_page_generator and markdown_validator crews
    const crewPy = `    @agent
    def senior_idea_analyst_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['senior_idea_analyst'],
            allow_delegation=False,
        )

    @agent
    def RequirementsManager(self) -> Agent:
        return Agent(config=self.agents_config['Requirements_Manager'])

    @task
    def expand_idea_task(self) -> Task:
        return Task(config=self.tasks_config['expand_idea_task'], agent=self.senior_idea_analyst_agent())

    @task
    def syntax_review_task(self) -> Task:
        return Task(config=self.tasks_config['syntax_review_task'], agent=self.RequirementsManager())
`;
    const { agents, warnings } = await crewai.parse(memoryTree({
      'config/agents.yaml': 'senior_idea_analyst:\n  role: Analyst\nRequirements_Manager:\n  role: Manager\n',
      'config/tasks.yaml': 'expand_idea_task:\n  description: Expand\nsyntax_review_task:\n  description: Review\n',
      'crew.py': crewPy,
    }));
    expect(agents.map((a) => [a.id, a.skills])).toEqual([
      ['senior_idea_analyst', ['expand_idea_task']],
      ['Requirements_Manager', ['syntax_review_task']],
    ]);
    expect(warnings).toEqual([]);
  });

  it('names agents and tasks after their crew when a project has several crews', async () => {
    const flow = memoryTree({
      'src/flow/crews/poem_crew/config/agents.yaml': 'poet:\n  role: Poet\n  goal: Write\n  backstory: Loves words\n',
      'src/flow/crews/poem_crew/config/tasks.yaml': 'write_poem:\n  description: Write a poem\n  expected_output: A poem\n  agent: poet\n',
      'src/flow/crews/edit_crew/config/agents.yaml': 'editor:\n  role: Editor\n  goal: Edit\n  backstory: Careful\n',
      'src/flow/crews/edit_crew/config/tasks.yaml': 'edit_poem:\n  description: Edit the poem\n  expected_output: A better poem\n  agent: editor\n',
    });
    const { agents, skills } = await crewai.parse(flow);
    expect(agents.map((a) => [a.id, a.skills])).toEqual([
      ['edit_crew:editor', ['edit_crew:edit_poem']],
      ['poem_crew:poet', ['poem_crew:write_poem']],
    ]);
    expect(skills.map((s) => s.id)).toEqual(['edit_crew:edit_poem', 'poem_crew:write_poem']);
  });

  it('keeps names unique when two crews share a folder name', async () => {
    // crewAI-examples has crews/marketing_strategy/src/marketing_posts and
    // integrations/nvidia_models/marketing_strategy/src/marketing_posts
    const crewFiles = (root: string) => ({
      [`${root}/config/agents.yaml`]: 'director:\n  role: Director\n',
      [`${root}/config/tasks.yaml`]: 'plan:\n  description: Plan\n  agent: director\n',
    });
    const { agents } = await crewai.parse(memoryTree({
      ...crewFiles('crews/marketing_strategy/src/marketing_posts'),
      ...crewFiles('integrations/nvidia_models/marketing_strategy/src/marketing_posts'),
      ...crewFiles('crews/trip/src/trip'),
    }));
    expect(agents.map((a) => a.id)).toEqual([
      'crews/marketing_strategy/src/marketing_posts:director',
      'trip:director',
      'nvidia_models/marketing_strategy/src/marketing_posts:director',
    ]);
  });

  it('warns about broken YAML, an agent without a role, and a task for an unknown agent', async () => {
    const { agents, warnings } = await crewai.parse(memoryTree({
      'config/agents.yaml': 'helper:\n  goal: Help\n',
      'config/tasks.yaml': 'lost:\n  description: Do it\n  expected_output: Done\n  agent: nobody\n',
      'crew.py': '',
      'other/config/agents.yaml': 'a: [',
      'other/config/tasks.yaml': '',
    }));
    // two crews, so names get a prefix; the one at the root has no folder name, so it is "crew"
    expect(agents.map((a) => a.id)).toEqual(['crew:helper']);
    expect(warnings).toEqual([
      'config/agents.yaml: agent "helper" has no role',
      'config/tasks.yaml: task "lost" is for agent "nobody", which is not in agents.yaml',
      expect.stringMatching(/^other\/config\/agents\.yaml is not valid YAML/),
    ]);
  });
});
