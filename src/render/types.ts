import type { AgentsDeckData, Level, StationId } from '../data/types';
import type { Simulation } from '../sim/simulation';

export type LayerId = 'axon' | 'skills' | 'roster';

/** What the detail window is showing. */
export type OpenTarget =
  | { type: 'skill'; id: string }
  | { type: 'room'; id: StationId }
  | { type: 'agent'; id: string }
  | { type: 'level'; id: Level };

/** Everything a renderer needs for one frame. */
export interface RenderState {
  sim: Simulation;
  data: AgentsDeckData;
  /** The agent being followed in the side panel. */
  sel: string;
  open: OpenTarget | null;
  reduce: boolean;
}

/** A tappable spot on the canvas. `follow` selects an agent in the side panel. */
export interface Hit {
  x: number;
  y: number;
  r: number;
  target: { type: 'follow'; id: string } | OpenTarget;
}

export interface RenderResult {
  hits: Hit[];
  /** For taps that miss every hit: the room or riser under the point, if any. */
  pickArea?: (x: number, y: number) => OpenTarget | null;
}

export type Renderer = (ctx: CanvasRenderingContext2D, cw: number, ch: number, t: number, s: RenderState) => RenderResult;
