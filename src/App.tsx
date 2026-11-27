import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentsDeckData } from './data/types';
import { Simulation } from './sim/simulation';
import type { Hit, LayerId, OpenTarget, RenderState } from './render';
import { AppContext, type Actions } from './components/actions';
import { DetailWindow } from './components/DetailWindow';
import { SidePanel } from './components/SidePanel';
import { Stage } from './components/Stage';

const LAYERS: [LayerId, string][] = [
  ['axon', 'L1 · Agent floor'],
  ['skills', 'B1 · Skills layer'],
  ['roster', 'Agent roster'],
];

const CAPTIONS: Record<LayerId, string> = {
  axon: 'Axonometric model at 30°, roof removed. Seated agents are working at a desk. Tap a room to open it.',
  skills: 'The level below the agents. Each GPU rack holds one skill and lights up while an agent on L1 calls it. Tap a rack to open the skill.',
  roster: 'Every agent on the team, lined up by level like a group photo. Tap an agent to see everything about it, or tap a step to learn what that level means.',
};

const isLayer = (v: string): v is LayerId => v === 'axon' || v === 'skills' || v === 'roster';
const layerFromHash = (): LayerId => {
  const h = location.hash.slice(1);
  return isLayer(h) ? h : 'axon';
};
const sameTarget = (a: OpenTarget | null, b: OpenTarget) => !!a && a.type === b.type && a.id === b.id;

export function App({ data }: { data: AgentsDeckData }) {
  const sim = useMemo(() => new Simulation(data), [data]);
  const reduce = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [view, setViewState] = useState<LayerId>(layerFromHash);
  const [sel, setSel] = useState(data.floorAgents[0]?.id ?? '');
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState<OpenTarget | null>(null);
  const [tab, setTab] = useState('overview');
  const [, setTick] = useState(0);

  // the canvas reads these every frame without re-rendering React
  const stateRef = useRef<RenderState>({ sim, data, sel, open, reduce });
  stateRef.current = { sim, data, sel, open, reduce };
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // refresh the panel and window text four times a second
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const setView = useCallback((v: LayerId) => {
    setViewState(v);
    // on phones the bottom sheet covers the model, so switching layers closes it
    if (matchMedia('(max-width: 640px)').matches) setOpen(null);
    try {
      history.replaceState(null, '', '#' + v);
    } catch {
      /* sandboxed */
    }
  }, []);

  useEffect(() => {
    const onHash = () => setViewState(layerFromHash());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    addEventListener('hashchange', onHash);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('keydown', onKey);
    };
  }, []);

  const actions: Actions = useMemo(
    () => ({
      follow: setSel,
      open: (t) => {
        setOpen((cur) => {
          if (!sameTarget(cur, t)) setTab('overview');
          return t;
        });
      },
      close: () => setOpen(null),
      setView,
    }),
    [setView],
  );

  const onTap = (target: Hit['target']) => {
    if (target.type === 'follow') actions.follow(target.id);
    else actions.open(target);
  };

  const ctx = useMemo(() => ({ data, sim, actions }), [data, sim, actions]);

  return (
    <AppContext.Provider value={ctx}>
      <div className="wrap">
        <header>
          <div className="eyebrow">AgentsDeck · Floor 1 · Revision C</div>
          <h1>Watch your agents work the floor</h1>
          <p className="lede">
            A cutaway architectural model of the office, in white and grey. The roof is lifted off and rooms are divided by glass, so you can see into every station. Agents walk
            the main corridor to whichever station their next tool call needs. Below them, a separate skills layer holds every skill in GPU racks, split into a stateless room
            and a stateful room. Tap an agent to follow it.
          </p>
        </header>

        <div className="bar">
          <div className="seg" role="group" aria-label="Layer">
            {LAYERS.map(([id, label]) => (
              <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>
                {label}
              </button>
            ))}
          </div>
          <p className="caption">{CAPTIONS[view]}</p>
        </div>

        <div className="stage">
          <Stage view={view} stateRef={stateRef} speedRef={speedRef} onTap={onTap}>
            {open && <DetailWindow open={open} tab={tab} onTab={setTab} />}
          </Stage>
          <SidePanel sel={sel} speed={speed} onSpeed={setSpeed} />
        </div>

        <div className="legend">
          <span><i className="sw glass" />Glass partition</span>
          <span><i className="sw hatch" />Stateful wing (keeps state)</span>
          <span><i className="sw" />Stateless wing</span>
          <span><i className="sw path" />Agent's route</span>
        </div>
        <p className="foot">All agents, tickets and skills are mock data from src/data/mock. Every layer reads one shared model, so it can be wired to a real event stream later.</p>
      </div>
    </AppContext.Provider>
  );
}
