import type { Skill } from '../../data/types';
import { rackLabel } from '../../render/skills';
import { fmtTime } from '../../sim/simulation';
import { AgentPill } from '../Chips';
import type { AppCtx } from '../actions';
import type { WindowContent } from './types';

/** Ends a description with a full stop, unless it already ends with punctuation. */
const sentence = (text: string) => (/[.!?…]$/.test(text.trim()) ? text.trim() : text.trim() + '.');

/** The SKILL.md text: the real file for a connected skill, a made-up one for the demo team. */
function skillMd(s: Skill) {
  if (s.instructions !== undefined) {
    return `---
name: ${s.id}
description: ${s.desc}
---

${s.instructions.trim()}
`;
  }
  const meta = [
    `name: ${s.id}`,
    `kind: ${s.kind === 'sl' ? 'stateless' : 'stateful'}`,
    ...(s.version ? [`version: ${s.version}`] : []),
    ...(s.runtime ? [`runtime: ${s.runtime}`] : []),
  ];
  const sections = [
    ...(s.input ? [`## Inputs\n${s.input}`] : []),
    ...(s.output ? [`## Output\n${s.output}`] : []),
    ...(s.steps?.length ? [`## Steps\n${s.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}`] : []),
    `## Rules\n${s.kind === 'sl' ? '- Keep nothing between calls. The same input always gives the same output.\n- Never write outside the sandbox.' : '- Read state from the store before working, and write it back before returning.\n- Only this skill may change its own state.'}`,
  ];
  return `---
${meta.join('\n')}
---

# ${s.id}

${sentence(s.desc)}

${sections.join('\n\n')}
`;
}

export function skillWindow(id: string, { sim, data, actions }: AppCtx): WindowContent | null {
  const s = data.skills[id];
  if (!s) return null;
  const k = s.kind;
  const callers = sim.agents.filter((a) => a.phase === 'work' && a.tool === id);
  const recent = sim.agents.flatMap((a) => a.log.filter((l) => l.tool === id).map((l) => ({ ...l, a }))).sort((p, q) => q.t - p.t);
  // a connected skill lists its real files; the demo team gets a typical set
  const files: [string, string][] = s.origin ? s.files : [['SKILL.md', '1.' + (id.length % 9) + ' KB'], ['schema.json', '0.6 KB'], ...s.files, ...(k === 'sf' ? ([['state/', 'store mount']] as [string, string][]) : [])];
  const where = rackLabel(data.skills, id);
  const pct = Math.round((s.fill ?? 0.5) * 100);
  const calls = sim.calls[id];

  return {
    title: id,
    sub: `${k === 'sl' ? 'STATELESS' : 'STATEFUL'} SKILL${s.version ? ' · v' + s.version : ''} · B1 ${where.toUpperCase()}`,
    tabs: [['overview', 'Overview'], ['md', 'SKILL.md'], ['files', 'Files'], ...(k === 'sf' ? ([['state', 'State']] as [string, string][]) : []), ['calls', 'Calls']],
    body: (tab) => {
      switch (tab) {
        case 'md':
          return <pre className="skw-pre">{skillMd(s)}</pre>;
        case 'files':
          return !files.length ? (
            <div className="skw-empty">No files listed for this skill.</div>
          ) : (
            <ul className="skw-list">
              {files.map((f) => (
                <li key={f[0]}>
                  <span className="m">{id}/{f[0]}</span>
                  <span className="r">{f[1]}</span>
                </li>
              ))}
            </ul>
          );
        case 'state':
          return (
            <>
              <div className="skw-note sf">Live view of this skill's store.{s.state ? ` ${s.state}.` : ''}</div>
              {s.stateTable && (
                <ul className="skw-list">
                  <li>
                    <span className="r" style={{ textAlign: 'left' }}>{s.stateTable.head[0]}</span>
                    <span className="r">{s.stateTable.head[1]} · {s.stateTable.head[2]}</span>
                  </li>
                  {s.stateTable.rows.map((r) => (
                    <li key={r[0]}>
                      <span className="m">{r[0]}</span>
                      <span className="r">{r[1]} · {r[2]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        case 'calls':
          return recent.length ? (
            <ul className="skw-list">
              {recent.slice(0, 10).map((l) => (
                <li key={l.a.id + l.t}>
                  <span>{l.a.name}: {l.text}</span>
                  <span className="r">{fmtTime(l.t)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="skw-empty">No calls this session yet.{calls ? ` ${calls} calls earlier today.` : ''}</div>
          );
        default:
          return (
            <>
              <p>{sentence(s.desc)}</p>
              <div className="skw-stats">
                <div><b>{calls}</b><span>calls today</span></div>
                <div><b>{s.latency ?? '–'}</b><span>avg latency</span></div>
                <div><b>{callers.length}</b><span>running now</span></div>
              </div>
              <div className={`skw-note ${k}`}>
                {k === 'sl'
                  ? '○ Stateless. It keeps nothing between calls, and the same input always gives the same output.'
                  : `● Stateful. It reads and writes its own store, so it remembers between calls.${s.state ? ` Holding ${s.state}.` : ''}`}
              </div>
              {k === 'sf' && (
                <div>
                  <h4>Store used · {pct}%</h4>
                  <div className="skw-gauge"><i style={{ width: pct + '%' }} /></div>
                </div>
              )}
              <dl className="skw-kv">
                {s.input && <><dt>Input</dt><dd>{s.input}</dd></>}
                {s.output && <><dt>Output</dt><dd>{s.output}</dd></>}
                {s.runtime && <><dt>Runtime</dt><dd>{s.runtime}</dd></>}
                <dt>Location</dt><dd>B1 · {where}</dd>
              </dl>
              <div>
                <h4>Called by right now</h4>
                {callers.length ? (
                  <div className="skw-callers">
                    {callers.map((a) => <AgentPill key={a.id} id={a.id} name={a.name} onClick={actions.follow} />)}
                  </div>
                ) : (
                  <div className="skw-empty">No agent is using it right now.</div>
                )}
              </div>
            </>
          );
      }
    },
  };
}
