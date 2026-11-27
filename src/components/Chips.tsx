import { useApp } from './actions';

/** A tool or skill name. Skills are buttons that open the skill window. */
export function ToolChip({ tool }: { tool: string }) {
  const { data, actions } = useApp();
  const skill = data.skills[tool];
  if (!skill)
    return (
      <span className="chip">
        <span className="k">tool</span>
        {tool}
      </span>
    );
  return (
    <button className={`chip ${skill.kind}`} onClick={() => actions.open({ type: 'skill', id: tool })}>
      <span className="k">{skill.kind === 'sl' ? 'stateless' : 'stateful'}</span>
      {tool}
    </button>
  );
}

/** Same look as ToolChip but never clickable, for the side panel's "Running" line. */
export function StaticChip({ tool }: { tool: string }) {
  const { data } = useApp();
  const kind = data.skills[tool]?.kind;
  return (
    <span className={`chip ${kind ?? ''}`}>
      <span className="k">{kind === 'sl' ? 'stateless' : kind === 'sf' ? 'stateful' : 'tool'}</span>
      {tool}
    </span>
  );
}

/** A round agent pill, e.g. in "Called by right now". */
export function AgentPill({ id, name, onClick, label }: { id: string; name: string; onClick: (id: string) => void; label?: string }) {
  return (
    <button className="pill" onClick={() => onClick(id)}>
      <i>{name[0]}</i>
      {label ?? name}
    </button>
  );
}
