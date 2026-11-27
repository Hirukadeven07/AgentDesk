import { useLayoutEffect, useRef, useState } from 'react';
import type { LayerId } from '../render';

interface Props {
  layers: [LayerId, string][];
  value: LayerId;
  onChange: (v: LayerId) => void;
}

/** Pill-shaped layer switch. A dark pill slides behind the active option. */
export function LayerToggle({ layers, value, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  // measure the active button so the pill can slide to it; re-measure on resize and font load
  useLayoutEffect(() => {
    const track = trackRef.current!;
    const measure = () => {
      const btn = track.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (btn) setPill({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [value]);

  // on narrow screens the track can scroll sideways; keep the active option in view
  useLayoutEffect(() => {
    const btn = trackRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  return (
    <div className="seg" role="group" aria-label="Layer" ref={trackRef}>
      {pill && <span className="seg-pill" aria-hidden="true" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />}
      {layers.map(([id, label]) => (
        <button key={id} aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
