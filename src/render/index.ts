import { drawFloor } from './floor';
import { drawRoster } from './roster';
import { drawSkills } from './skills';
import type { LayerId, Renderer } from './types';

export const RENDERERS: Record<LayerId, Renderer> = {
  axon: drawFloor,
  skills: drawSkills,
  roster: drawRoster,
};

export * from './types';
