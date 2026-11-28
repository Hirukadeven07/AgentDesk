import { useState } from 'react';
import { App } from './App';
import { ConnectDialog } from './components/ConnectDialog';
import { ProjectBar } from './components/ProjectBar';
import type { Connected } from './connect/connect';
import { mockData } from './data/mock';

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
        bar={<ProjectBar project={project} onConnect={() => setConnecting(true)} onDemo={() => setProject(null)} />}
      />
      {connecting && (
        <ConnectDialog
          onClose={() => setConnecting(false)}
          onConnected={(p) => {
            setProject(p);
            setConnecting(false);
          }}
        />
      )}
    </>
  );
}
