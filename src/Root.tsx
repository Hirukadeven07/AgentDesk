import { lazy, Suspense, useState } from 'react';
import { App } from './App';
import { ProjectBar } from './components/ProjectBar';
import type { Connected } from './connect/connect';
import { mockData } from './data/mock';

// the dialog brings every adapter and the YAML and TOML parsers, so it loads only when opened
const ConnectDialog = lazy(() => import('./components/ConnectDialog').then((m) => ({ default: m.ConnectDialog })));

/** Which project the app shows: the demo team, or one the user connected. */
export function Root() {
  const [project, setProject] = useState<Connected | null>(null);
  const [connecting, setConnecting] = useState(false);
  return (
    <>
      {/* a new key starts the app fresh for each project, so nothing from the last one lingers */}
      <App
        key={project?.name ?? 'demo'}
        data={project?.data ?? mockData}
        project={project?.name}
        bar={<ProjectBar project={project} onConnect={() => setConnecting(true)} onDemo={() => setProject(null)} />}
      />
      {connecting && (
        <Suspense fallback={null}>
          <ConnectDialog
            onClose={() => setConnecting(false)}
            onConnected={(p) => {
              // nobody is on the floor of a connected project yet, so open it on the roster instead
              if (!p.data.floorAgents.length && (location.hash === '' || location.hash === '#axon')) location.hash = 'roster';
              setProject(p);
              setConnecting(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
