import { fmtTime } from '../sim/simulation';
import { STATIONS } from '../world/floor';
import { useApp } from './actions';
import { StaticChip } from './Chips';

const SPEEDS: [number, string][] = [[0, 'Pause'], [1, '1×'], [3, '3×']];

export function SidePanel({ sel, speed, onSpeed }: { sel: string; speed: number; onSpeed: (s: number) => void }) {
  const { sim, data, actions } = useApp();
  const a = sim.agents.find((x) => x.id === sel) ?? sim.agents[0];
  const cur = a.steps[a.idx];
  const where = STATIONS[cur.station];

  return (
    <aside className="panel">
      <div className="p-sec">
        <div className="p-top">
          <div>
            <div className="clock">{fmtTime(sim.t)}</div>
            <div className="live">
              <i />
              LIVE · MOCK DATA
            </div>
          </div>
          <div className="speed" role="group" aria-label="Playback speed">
            {SPEEDS.map(([v, label]) => (
              <button key={v} aria-pressed={speed === v} onClick={() => onSpeed(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-sec">
        <div className="p-h">Agents on the floor</div>
        <div className="roster">
          {sim.agents.map((ag) => (
            <button key={ag.id} className="ag" aria-pressed={ag.id === a.id} onClick={() => actions.follow(ag.id)}>
              <span className="badge">{ag.name[0]}</span>
              <span className="nm">
                {ag.name} <span className="role">{ag.role}</span>
              </span>
              <span className="st">{ag.phase === 'walk' ? 'Walking to ' + STATIONS[ag.steps[ag.idx].station].name : ag.steps[ag.idx].text}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-sec">
        <div className="p-h">Following</div>
        <div className="d-name">
          <span className="badge on">{a.name[0]}</span>
          {a.name}
          <span className="role">{a.role}</span>
        </div>
        <div className="d-task">
          <span>Task:</span> {a.task}
        </div>
        <div className="now">
          <div className="where">{(a.phase === 'walk' ? 'WALKING TO ' : 'AT ') + where.code + ' ' + where.name.toUpperCase()}</div>
          <div>
            {a.phase === 'walk' ? 'Next' : 'Running'} <StaticChip tool={cur.tool} />
          </div>
          <div>{cur.text}</div>
        </div>
        <ol className="steps">
          {a.steps.map((s, i) => (
            <li key={i} className={i === a.idx ? 'cur' : ''}>
              <b>{i < a.idx ? '✓' : i === a.idx ? '▸' : i + 1}</b>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <div className="p-h">Activity</div>
        <ul className="log">
          {a.log.slice(0, 9).map((l) => (
            <li key={l.t + l.text}>
              <time>{fmtTime(l.t)}</time>
              <span className={l.k === 'walk' ? 'walk' : l.k === 'done' ? 'done' : ''}>{l.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-sec">
        <div className="p-h">Skills library</div>
        <div className="lib">
          {(['sl', 'sf'] as const).map((kd) => (
            <div key={kd} className={`wing ${kd}`}>
              <div className="wh">{kd === 'sl' ? 'Stateless wing · B3' : 'Stateful wing · B4'}</div>
              <div className="wd">{kd === 'sl' ? 'Same input, same output. Nothing remembered.' : 'Keeps memory, sessions or cursors between calls.'}</div>
              {Object.values(data.skills)
                .filter((s) => s.kind === kd)
                .map((s) => (
                  <button key={s.id} className="sk" onClick={() => actions.open({ type: 'skill', id: s.id })}>
                    <div className="row">
                      <b>{s.id}</b>
                      <span className="users">
                        {sim.agents
                          .filter((x) => x.phase === 'work' && x.tool === s.id)
                          .map((x) => (
                            <span key={x.id} title={x.name}>
                              {x.name[0]}
                            </span>
                          ))}
                      </span>
                    </div>
                    <div className="meta">{s.state || s.desc}</div>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
