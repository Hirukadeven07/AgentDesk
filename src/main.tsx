import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import './styles.css';
import { App } from './App';
import { mockData } from './data/mock';

// To use real data later, build an AgentDeskData object (see src/data/types.ts)
// and pass it here instead of mockData.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App data={mockData} />
  </StrictMode>,
);
