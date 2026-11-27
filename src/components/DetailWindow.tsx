import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { OpenTarget } from '../render/types';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useApp, type AppCtx } from './actions';
import { agentWindow } from './windows/AgentWindow';
import { levelWindow } from './windows/LevelWindow';
import { roomWindow } from './windows/RoomWindow';
import { skillWindow } from './windows/SkillWindow';
import type { WindowContent } from './windows/types';

function contentFor(open: OpenTarget, ctx: AppCtx): WindowContent | null {
  switch (open.type) {
    case 'skill':
      return skillWindow(open.id, ctx);
    case 'room':
      return roomWindow(open.id, ctx);
    case 'agent':
      return agentWindow(open.id, ctx);
    case 'level':
      return levelWindow(open.id, ctx);
  }
}

/**
 * The tabbed detail window. Floats bottom-right of the model on wide screens,
 * and becomes a bottom sheet on phones (drag the header down to close).
 */
export function DetailWindow({ open, tab, onTab }: { open: OpenTarget; tab: string; onTab: (t: string) => void }) {
  const ctx = useApp();
  const sheet = useMediaQuery('(max-width: 640px)');
  const bodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ y0: number; dy: number } | null>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab, open.type, open.id]);

  const c = contentFor(open, ctx);
  if (!c) return null;
  const tabs = c.tabs.some(([id]) => id === tab) ? tab : 'overview';

  const onDown = (e: PointerEvent) => {
    if (!sheet || (e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ y0: e.clientY, dy: 0 });
  };
  const onMove = (e: PointerEvent) => {
    if (drag) setDrag({ ...drag, dy: Math.max(0, e.clientY - drag.y0) });
  };
  const onUp = () => {
    if (drag && drag.dy > 80) ctx.actions.close();
    setDrag(null);
  };

  return (
    <div
      className="skwin"
      role="dialog"
      aria-label={c.title + ' details'}
      style={drag ? { transform: `translateY(${drag.dy}px)`, transition: 'none' } : undefined}
    >
      <div className="skw-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="skw-grip" aria-hidden="true" />
        <div className="skw-name">{c.title}</div>
        <button className="skw-x" aria-label="Close" onClick={ctx.actions.close}>×</button>
        <div className="skw-sub">{c.sub}</div>
      </div>
      <div className="skw-tabs" role="tablist">
        {c.tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={id === tabs} onClick={() => onTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="skw-body" ref={bodyRef}>
        {c.body(tabs)}
      </div>
    </div>
  );
}
