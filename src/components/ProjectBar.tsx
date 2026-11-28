import { describeFound, type Connected } from '../connect/connect';
import { PLATFORM_LABELS } from '../connect/platforms';

/**
 * Beside the layer toggle: a button to connect a project while the demo team is showing, or the
 * connected project's name, what was found, any warnings, and the way back to the demo.
 */
export function ProjectBar({ project, onConnect, onDemo }: { project: Connected | null; onConnect: () => void; onDemo: () => void }) {
  if (!project)
    return (
      <button className="pb-connect" onClick={onConnect}>
        Connect your project
      </button>
    );
  const { name, summary, warnings } = project;
  return (
    <div className="pb">
      <div className="pb-main">
        <span className="pb-name">{name}</span>
        <span className="pb-found">{describeFound(summary, PLATFORM_LABELS)}</span>
        {warnings.length > 0 && (
          <details className="pb-warn">
            <summary>
              {warnings.length} warning{warnings.length === 1 ? '' : 's'}
            </summary>
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="pb-actions">
        <button onClick={onConnect}>Connect another</button>
        <button onClick={onDemo}>Back to demo</button>
      </div>
    </div>
  );
}
