import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { memoryTree } from '../connect/fileTree';
import { scan } from '../connect/scan';
import { mockData } from '../data/mock';
import type { AgentsDeckData } from '../data/types';
import { Simulation } from '../sim/simulation';
import { AppContext } from './actions';
import { SidePanel } from './SidePanel';

const render = (data: AgentsDeckData, sel = '') =>
  renderToStaticMarkup(
    <AppContext.Provider value={{ data, sim: new Simulation(data), actions: { follow: () => {}, open: () => {}, close: () => {}, setView: () => {} } }}>
      <SidePanel sel={sel} speed={1} onSpeed={() => {}} />
    </AppContext.Provider>,
  );

describe('SidePanel', () => {
  it('shows a connected project, where nobody is on the floor yet', async () => {
    const { data } = await scan(memoryTree({ 'CLAUDE.md': 'Hi', '.claude/skills/pr/SKILL.md': '---\nname: pr\ndescription: PR bodies.\n---\nBody' }));
    const html = render(data);
    expect(html).toContain('No agents on the floor yet');
    expect(html).not.toContain('Following');
    // the skills library still lists every skill
    expect(html).toContain('PR bodies.');
  });

  it('still follows an agent of the demo team', () => {
    const html = render(mockData, 'atlas');
    expect(html).toContain('Following');
    expect(html).toContain('Atlas');
    expect(html).not.toContain('No agents on the floor yet');
  });
});
