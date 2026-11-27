import { createContext, useContext } from 'react';
import type { AgentDeskData } from '../data/types';
import type { Simulation } from '../sim/simulation';
import type { LayerId, OpenTarget } from '../render/types';

/** What any component can ask the app to do. */
export interface Actions {
  /** Follow an agent in the side panel. */
  follow: (id: string) => void;
  open: (target: OpenTarget) => void;
  close: () => void;
  setView: (v: LayerId) => void;
}

export interface AppCtx {
  data: AgentDeskData;
  sim: Simulation;
  actions: Actions;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp() {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp must be used inside AppContext');
  return v;
}
