import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { App } from './App';
import { ProjectBar, type ProjectStatus } from './components/ProjectBar';
import type { Connected } from './connect/connect';
import { addressFor, forgetProject, loadProject, saveProject, startWith, type KeyValueStore } from './connect/remember';
import { mockData } from './data/mock';

// the dialog brings every adapter and the YAML and TOML parsers, so it loads only when opened
const ConnectDialog = lazy(() => import('./components/ConnectDialog').then((m) => ({ default: m.ConnectDialog })));

/** localStorage, or nothing when the browser blocks it (some private modes and embedded pages). */
function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Which project the app shows: the demo team, or one the user connected. */
export function Root() {
  const store = useRef(browserStore()).current;
  const [start] = useState(() => startWith(location.href, store && loadProject(store)));
  const [project, setProject] = useState<Connected | null>(start.show);
  const [status, setStatus] = useState<ProjectStatus>(start.connect ? { connecting: start.connect } : {});
  const [connecting, setConnecting] = useState(false);

  const show = useCallback(
    (p: Connected | null) => {
      // nobody is on the floor of a connected project yet, so open it on the roster instead
      if (p && !p.data.floorAgents.length && (location.hash === '' || location.hash === '#axon')) location.hash = 'roster';
      setProject(p);
      setStatus({});
      if (store) (p ? saveProject(p, store) : forgetProject(store));
      history.replaceState(history.state, '', addressFor(location.href, p));
    },
    [store],
  );

  // a shared ?repo= link: connect that repo once, as soon as the page opens
  const started = useRef(false);
  useEffect(() => {
    if (!start.connect || started.current) return;
    started.current = true;
    import('./connect/connect')
      .then(({ connectProject }) => connectProject({ kind: 'github', input: start.connect! }))
      .then((r) => (r.ok ? show(r.project) : setStatus({ error: r.error })));
  }, [start.connect, show]);

  return (
    <>
      {/* a new key starts the app fresh for each project, so nothing from the last one lingers */}
      <App
        key={project?.name ?? 'demo'}
        data={project?.data ?? mockData}
        project={project?.name}
        bar={
          <ProjectBar
            project={project}
            status={status}
            onConnect={() => setConnecting(true)}
            onDemo={() => show(null)}
            onDismiss={() => {
              // drop the link that failed, so a reload doesn't try it again
              setStatus({});
              history.replaceState(history.state, '', addressFor(location.href, project));
            }}
          />
        }
      />
      {connecting && (
        <Suspense fallback={null}>
          <ConnectDialog
            onClose={() => setConnecting(false)}
            onConnected={(p) => {
              show(p);
              setConnecting(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
