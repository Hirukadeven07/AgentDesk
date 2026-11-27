import type { Level } from '../../data/types';
import { getAgentInfo, shortTool } from '../../lib/agentInfo';
import { ToolChip } from '../Chips';
import type { AppCtx } from '../actions';
import type { WindowContent } from './types';

export function levelWindow(level: Level, { sim, data, actions }: AppCtx): WindowContent | null {
  const L = data.levels[level];
  const tr = data.tiers.find((t) => t.level === level);
  if (!L || !tr) return null;
  const infos = tr.agentIds.map((id) => getAgentInfo(id, sim, data));
  const onFloor = infos.filter((i) => i.live).length;
  const idle = infos.filter((i) => i.status === 'idle').length;
  const off = infos.filter((i) => i.status === 'offline').length;
  const done = infos.reduce((s, i) => s + i.stats.tasksDone, 0);
  // a level with no agents yet has no average, so show a dash instead of "NaN%"
  const succ = infos.length ? (infos.reduce((s, i) => s + Number(i.stats.successRate), 0) / infos.length).toFixed(1) + '%' : '–';
  const skills = [...new Set(infos.flatMap((i) => i.skills))];
  const config = `level: L${level}
name: ${L.title.toLowerCase()}
model: ${L.cfg.model}
max_turns: ${L.cfg.turns}
budget: ${L.cfg.budget}
permissions:
  write_files: ${L.cfg.files}
  run_shell: ${L.cfg.shell}
  hand_off_to: ${L.cfg.handoff}
members: [${tr.agentIds.join(', ')}]`;

  return {
    title: `L${level} · ${L.title}`,
    sub: `AGENT LEVEL · ${infos.length} AGENTS · ${onFloor} ON THE FLOOR`,
    tabs: [['overview', 'Overview'], ['agents', 'Agents'], ['rules', 'Rules'], ['config', 'Config']],
    body: (tab) => {
      switch (tab) {
        case 'agents':
          return (
            <>
              <div className="skw-stats">
                <div><b>{onFloor}</b><span>on the floor</span></div>
                <div><b>{idle}</b><span>idle</span></div>
                <div><b>{off}</b><span>offline</span></div>
              </div>
              <ul className="skw-list">
                {infos.map((i) => (
                  <li key={i.id}>
                    <span>
                      <button className="skw-link" onClick={() => actions.open({ type: 'agent', id: i.id })}>{i.name}</button> · {i.role}
                    </span>
                    <span className="r">
                      {i.status === 'working' && i.live ? '● ' + shortTool(i.live.tool) : i.status === 'walking' ? '● walking' : i.status === 'idle' ? '○ idle' : '◌ offline'}
                    </span>
                  </li>
                ))}
              </ul>
              <div>
                <h4>Skills used at this level</h4>
                <div className="skw-callers">{skills.map((s) => <ToolChip key={s} tool={s} />)}</div>
              </div>
            </>
          );
        case 'rules':
          return (
            <>
              <div>
                <h4>Can</h4>
                <ul className="skw-list">{L.does.map((d) => <li key={d}><span>✓ {d}</span><span /></li>)}</ul>
              </div>
              <div>
                <h4>Limits</h4>
                <ul className="skw-list">{L.cant.map((d) => <li key={d}><span>– {d}</span><span /></li>)}</ul>
              </div>
            </>
          );
        case 'config':
          return (
            <>
              <pre className="skw-pre">{config}</pre>
              <div className="skw-empty">Every agent at this level starts from these defaults. An agent's own Config tab shows any overrides.</div>
            </>
          );
        default:
          return (
            <>
              <p>{L.summary}</p>
              <div className="skw-stats">
                <div><b>{infos.length}</b><span>agents</span></div>
                <div><b>{onFloor}</b><span>on the floor</span></div>
                <div><b>{succ}</b><span>avg success</span></div>
              </div>
              <div>
                <h4>What this level does</h4>
                <ul className="skw-list">{L.does.map((d) => <li key={d}><span>{d}</span><span /></li>)}</ul>
              </div>
              <dl className="skw-kv">
                <dt>Model</dt><dd>{L.cfg.model}</dd>
                <dt>Max turns</dt><dd>{L.cfg.turns}</dd>
                <dt>Hands off to</dt><dd>{L.cfg.handoff}</dd>
                <dt>Tasks done</dt><dd>{done} in total</dd>
              </dl>
              <div className="skw-note">
                {level === 3 ? 'Top of the chain. Work flows down from here.' : level === 2 ? 'Middle of the chain. Takes tickets from L3, reports back to L3.' : 'Bottom of the chain. Takes jobs from L2 or L3 and reports back.'}
              </div>
            </>
          );
      }
    },
  };
}
