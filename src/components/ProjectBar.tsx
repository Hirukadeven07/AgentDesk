import { useState } from 'react';
import type { Connected } from '../connect/connect';
import { describeFound } from '../connect/describe';
import { PLATFORM_LABELS } from '../connect/platforms';

/** A shared link being connected, or why it could not be. */
export type ProjectStatus = { connecting?: string; error?: string };

/**
 * Beside the layer toggle: a button to connect a project while the demo team is showing, or the
 * connected project's name, what was found, any warnings, and the way back to the demo. While a
 * shared link connects, it says so; if that fails, it says why.
 */
export function ProjectBar({
  project,
  status,
  onConnect,
  onDemo,
  onDismiss,
}: {
  project: Connected | null;
  status: ProjectStatus;
  onConnect: () => void;
  onDemo: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (status.connecting)
    return (
      <div className="pb" aria-live="polite">
        <span className="pb-found">Connecting {status.connecting}…</span>
      </div>
    );
  if (status.error)
    return (
      <div className="pb pb-err" role="alert">
        <span>{status.error}</span>
        <div className="pb-actions">
          <button onClick={onConnect}>Connect a project</button>
          <button onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    );
  if (!project)
    return (
      <button className="pb-connect" onClick={onConnect}>
        Connect your project
      </button>
    );

  const { name, summary, warnings, from } = project;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no clipboard access: the link is in the address bar */
    }
  };
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
        {/* only a GitHub repo can be opened by someone else from a link */}
        {from.kind === 'github' && <button onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>}
        <button onClick={onConnect}>Connect another</button>
        <button onClick={onDemo}>Back to demo</button>
      </div>
    </div>
  );
}
