import type { StationId } from '../../data/types';
import { shortTool } from '../../lib/agentInfo';
import { fmtTime, type LiveAgent } from '../../sim/simulation';
import { STATIONS } from '../../world/floor';
import { ToolChip } from '../Chips';
import type { AppCtx } from '../actions';
import type { WindowContent } from './types';

export function roomWindow(id: StationId, { sim, data, actions }: AppCtx): WindowContent | null {
  const st = STATIONS[id];
  const R = data.rooms[id];
  if (!st || !R) return null;
  const z = st.zone;
  const here = sim.agents.filter((a) => a.seat.st === id && a.phase === 'work');
  const coming = sim.agents.filter((a) => a.seat.st === id && a.phase === 'walk');
  const tools = [...new Set(sim.agents.flatMap((a) => a.steps.filter((s) => s.station === id).map((s) => s.tool)))];
  const acts = sim.agents.flatMap((a) => a.log.filter((l) => l.st === id && l.k !== 'walk').map((l) => ({ ...l, a }))).sort((p, q) => q.t - p.t);
  const area = ((z[2] - z[0]) * (z[3] - z[1]) * 0.25).toFixed(1);

  const agentRow = (a: LiveAgent, walk: boolean) => (
    <li key={a.id}>
      <span>
        <button className="skw-link" onClick={() => actions.follow(a.id)}>{a.name}</button>{' '}
        {walk ? 'is walking here to run ' + a.steps[a.idx].tool : '· ' + a.steps[a.idx].text}
      </span>
      <span className="r">{walk ? 'on the way' : shortTool(a.tool)}</span>
    </li>
  );

  return {
    title: `${st.code} · ${st.name}`,
    sub: `ROOM · LEVEL L1 · ${here.length} WORKING · ${coming.length} ON THE WAY`,
    tabs: [['overview', 'Overview'], ['agents', 'Agents'], ['queue', 'Queue'], ['kit', 'Equipment'], ['activity', 'Activity']],
    body: (tab) => {
      switch (tab) {
        case 'agents':
          return here.length || coming.length ? (
            <ul className="skw-list">
              {here.map((a) => agentRow(a, false))}
              {coming.map((a) => agentRow(a, true))}
            </ul>
          ) : (
            <div className="skw-empty">No agents are here or heading here.</div>
          );
        case 'queue': {
          const q: [string, string][] = [...coming.map((a) => [a.name + ': ' + a.steps[a.idx].text, 'arriving'] as [string, string]), ...R.backlog.map((b) => [b, 'waiting'] as [string, string])];
          return q.length ? (
            <ul className="skw-list">
              {q.map((r) => (
                <li key={r[0]}><span>{r[0]}</span><span className="r">{r[1]}</span></li>
              ))}
            </ul>
          ) : (
            <div className="skw-empty">No queue. Agents come here straight from other stations.</div>
          );
        }
        case 'kit':
          return (
            <ul className="skw-list">
              {R.kit.map((k) => (
                <li key={k[0]}><span>{k[0]}</span><span className="r">× {k[1]}</span></li>
              ))}
            </ul>
          );
        case 'activity':
          return acts.length ? (
            <ul className="skw-list">
              {acts.slice(0, 12).map((l) => (
                <li key={l.a.id + l.t}><span>{l.a.name}: {l.text}</span><span className="r">{fmtTime(l.t)}</span></li>
              ))}
            </ul>
          ) : (
            <div className="skw-empty">Nothing has happened here this session yet.</div>
          );
        default:
          return (
            <>
              <p>{R.purpose}</p>
              <div className="skw-stats">
                <div><b>{here.length}/{st.seats.length}</b><span>seats in use</span></div>
                <div><b>{coming.length}</b><span>on the way</span></div>
                <div><b>{acts.length}</b><span>jobs this session</span></div>
              </div>
              <dl className="skw-kv">
                <dt>Room</dt><dd>{st.code} · {st.name}</dd>
                <dt>Area</dt><dd>{area} m² · {(z[2] - z[0]) * 0.5} × {(z[3] - z[1]) * 0.5} m</dd>
                <dt>Seats</dt><dd>{st.seats.length}</dd>
              </dl>
              <div>
                <h4>Who is here</h4>
                {here.length ? <ul className="skw-list">{here.map((a) => agentRow(a, false))}</ul> : <div className="skw-empty">Nobody is working here right now.</div>}
              </div>
              <div>
                <h4>Tools and skills used here</h4>
                <div className="skw-callers">{tools.map((t) => <ToolChip key={t} tool={t} />)}</div>
              </div>
            </>
          );
      }
    },
  };
}
