import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { memoryTree } from './connect/fileTree';
import { scan } from './connect/scan';
import { mockData } from './data/mock';

describe('App wording', () => {
  it('describes the demo team as mock data', () => {
    const html = renderToStaticMarkup(<App data={mockData} />);
    expect(html).toContain('Watch your agents work the floor');
    expect(html).toContain('LIVE · MOCK DATA');
    expect(html).toContain('mock data from src/data/mock');
  });

  it('describes a connected project as the project, never as mock data', async () => {
    const { data } = await scan(memoryTree({ 'CLAUDE.md': 'Hi' }));
    const html = renderToStaticMarkup(<App data={data} project="acme/shop" />);
    expect(html).toContain('acme/shop');
    expect(html).toContain('NOT LIVE YET');
    expect(html).toContain('Nothing is stored on a server');
    expect(html.toLowerCase()).not.toContain('mock');
  });
});
