import { getAgentInfo } from '../../lib/agentInfo';
import { fmtTime } from '../../sim/simulation';
import { STATIONS } from '../../world/floor';
import { AgentPill, ToolChip } from '../Chips';
import type { AppCtx } from '../actions';
import type { WindowContent } from './types';

export function agentWindow(id: string, { sim, data, actions }: AppCtx): WindowContent | null {
  const I = getAgentInfo(id, sim, data);
  const a = I.live;
  const st = a ? STATIONS[a.seat.st] : null;
  const note = a && st
    ? a.phase === 'work'
      ? <>● Working. Running <b>{a.tool}</b> at {st.code} {st.name}.</>
      : <>● On the floor, walking to {st.name}.</>
    : I.status === 'idle'
      ? I.last ? `○ Idle. Last finished “${I.last}” ${I.ago}.` : '○ Idle. Not working on anything right now.'
      : I.last ? `◌ Offline. Last seen ${I.ago} after “${I.last}”.` : '◌ Offline.';
  const { model, tasksDone, callsToday, successRate, joined } = I.stats;
  // a connected agent has no made-up numbers, so the stats row only shows for the demo team
  const hasStats = tasksDone !== undefined || callsToday !== undefined || successRate !== undefined;
  const followOnFloor = () => {
    actions.follow(id);
    actions.close();
    actions.setView('axon');
  };
  const config = `name: ${I.id}
role: ${I.role}
level: L${I.tier}
model: ${model ?? 'default'}
max_turns: ${I.tier === 3 ? 80 : I.tier === 2 ? 40 : 20}
tools: [${I.tools.join(', ')}]
skills: [${I.skills.join(', ')}]
permissions:
  write_files: ${I.tier > 1 || I.id === 'atlas' ? 'yes' : 'repo only'}
  run_shell: ${I.tools.includes('bash') ? 'yes' : 'no'}
  hand_off_to: ${I.tier === 3 ? 'any agent' : 'L' + (I.tier + 1) + ' and above'}
instructions: |
  You are ${I.name}, the ${I.role.toLowerCase()}.
  Pick up tickets at Dispatch, use only the
  skills listed here, and hand results back.`;

  return {
    title: I.name,
    sub: `AGENT · L${I.tier} ${I.tierName} · ${I.status.toUpperCase()}`,
    tabs: [['overview', 'Overview'], ['skills', 'Skills'], ['task', 'Task'], ['history', 'History'], ['config', 'Config']],
    body: (tab) => {
      switch (tab) {
        case 'skills':
          return (
            <>
              <div>
                <h4>Skills ({I.skills.length})</h4>
                <div className="skw-callers">{I.skills.map((s) => <ToolChip key={s} tool={s} />)}</div>
              </div>
              <div>
                <h4>Tools</h4>
                <div className="skw-callers">{I.tools.map((t) => <ToolChip key={t} tool={t} />)}</div>
              </div>
              <div className="skw-empty">Tap a skill to open it.</div>
            </>
          );
        case 'task':
          return a ? (
            <div>
              <h4>{a.task}</h4>
              <ol className="steps" style={{ marginTop: 6 }}>
                {a.steps.map((s, i) => (
                  <li key={i} className={i === a.idx ? 'cur' : ''}>
                    <b>{i < a.idx ? '✓' : i === a.idx ? '▸' : i + 1}</b>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="skw-empty">No task assigned.{I.last ? ` Last task: ${I.last} (${I.ago}).` : ''}</div>
          );
        case 'history': {
          const rows: [string, string][] = a
            ? a.log.slice(0, 14).map((l) => [l.text, fmtTime(l.t)])
            : I.last
              ? [[I.last, I.ago ?? ''], ['Picked up a ticket from Dispatch', 'earlier'], ...(I.skills[0] ? [['Used ' + I.skills[0], 'earlier'] as [string, string]] : []), ['Handed results back', 'earlier']]
              : [];
          return !rows.length ? (
            <div className="skw-empty">No activity yet.</div>
          ) : (
            <ul className="skw-list">
              {rows.map((r, i) => (
                <li key={i}><span>{r[0]}</span><span className="r">{r[1]}</span></li>
              ))}
            </ul>
          );
        }
        case 'config':
          return <pre className="skw-pre">{config}</pre>;
        default:
          return (
            <>
              <p>{I.role} · level L{I.tier} {I.tierName.toLowerCase()}.</p>
              <div className={`skw-note ${a ? 'sf' : ''}`}>{note}</div>
              {hasStats && (
                <div className="skw-stats">
                  <div><b>{tasksDone ?? '–'}</b><span>tasks done</span></div>
                  <div><b>{callsToday ?? '–'}</b><span>tool calls today</span></div>
                  <div><b>{successRate === undefined ? '–' : successRate + '%'}</b><span>success rate</span></div>
                </div>
              )}
              <dl className="skw-kv">
                <dt>Model</dt><dd>{model ?? 'default'}</dd>
                <dt>Level</dt><dd>L{I.tier} · {I.tierName.toLowerCase()}</dd>
                <dt>Where</dt><dd>{I.where}</dd>
                <dt>Task</dt><dd>{a ? a.task : 'none'}</dd>
                {joined && <><dt>Since</dt><dd>{joined}</dd></>}
              </dl>
              {a && (
                <div className="skw-callers">
                  <AgentPill id={id} name={I.name} label="Follow on the agent floor" onClick={followOnFloor} />
                </div>
              )}
            </>
          );
      }
    },
  };
}
