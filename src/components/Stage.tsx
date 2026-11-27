import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { RENDERERS, type Hit, type LayerId, type OpenTarget, type RenderResult, type RenderState } from '../render';

interface Props {
  view: LayerId;
  /** Latest render state, read by the animation loop every frame. */
  stateRef: MutableRefObject<RenderState>;
  speedRef: MutableRefObject<number>;
  onTap: (target: Hit['target'] | OpenTarget) => void;
  children?: ReactNode;
}

/** The canvas model. Runs the animation loop and turns taps into targets. */
export function Stage({ view, stateRef, speedRef, onTap, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ cw: 800, ch: 520 });
  const last = useRef<RenderResult>({ hits: [] });
  const viewRef = useRef(view);
  viewRef.current = view;

  // keep the canvas sharp at any width; phones get a taller aspect
  useEffect(() => {
    const box = boxRef.current!;
    const cv = cvRef.current!;
    const resize = () => {
      const cw = Math.max(300, box.getBoundingClientRect().width);
      const ch = Math.round(cw * (cw < 560 ? 0.78 : 0.66));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
      cv.style.height = ch + 'px';
      size.current = { cw, ch };
      box.closest<HTMLElement>('.stage')?.style.setProperty('--stage-h', ch + 'px');
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();
    return () => ro.disconnect();
  }, []);

  // animation loop: advance the simulation, then draw the current layer
  useEffect(() => {
    const cv = cvRef.current!;
    const ctx = cv.getContext('2d')!;
    let prev = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const s = stateRef.current;
      if (speedRef.current > 0) s.sim.step(dt * speedRef.current);
      const { cw, ch } = size.current;
      const dpr = cv.width / cw;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      last.current = RENDERERS[viewRef.current](ctx, cw, ch, now / 1000, s);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stateRef, speedRef]);

  /** What a tap at this point of the canvas would open, if anything. */
  const pick = (e: React.MouseEvent<HTMLCanvasElement>): Hit['target'] | OpenTarget | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // fingers are less precise than a mouse, so widen hit targets on touch screens
    const grow = matchMedia('(pointer: coarse)').matches ? 1.4 : 1;
    let best: Hit | null = null;
    let bd = Infinity;
    for (const h of last.current.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.r * grow && d < bd) {
        bd = d;
        best = h;
      }
    }
    return best ? best.target : last.current.pickArea?.(x, y) ?? null;
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const target = pick(e);
    if (target) onTap(target);
  };

  // only show the hand cursor over something a click would open
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cursor = pick(e) ? 'pointer' : 'default';
    if (e.currentTarget.style.cursor !== cursor) e.currentTarget.style.cursor = cursor;
  };

  return (
    <div className="cbox" ref={boxRef}>
      <canvas ref={cvRef} onClick={onClick} onMouseMove={onMouseMove} aria-label="Animated architectural model of the AgentsDeck office" />
      {children}
    </div>
  );
}
