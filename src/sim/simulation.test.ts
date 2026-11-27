import { describe, expect, it } from 'vitest';
import { mockData } from '../data/mock';
import { STATIONS } from '../world/floor';
import { Simulation } from './simulation';

describe('Simulation', () => {
  it('puts every floor agent on the floor, mid-task, after warming up', () => {
    const sim = new Simulation(mockData);
    expect(sim.agents.map((a) => a.id)).toEqual(mockData.floorAgents.map((a) => a.id));
    expect(sim.t).toBeGreaterThan(0);
    for (const a of sim.agents) {
      expect(a.idx).toBeGreaterThanOrEqual(0);
      expect(a.idx).toBeLessThan(a.steps.length);
      expect(a.log.length).toBeGreaterThan(0);
    }
  });

  it('never seats two agents in the same seat', () => {
    const sim = new Simulation(mockData);
    for (let i = 0; i < 600; i++) {
      sim.step(0.5);
      const taken = sim.agents.filter((a) => a.seat.i >= 0).map((a) => `${a.seat.st}:${a.seat.i}`);
      expect(new Set(taken).size).toBe(taken.length);
    }
  });

  it('only gives out seats that exist in the room', () => {
    const sim = new Simulation(mockData);
    for (let i = 0; i < 300; i++) {
      sim.step(0.5);
      for (const a of sim.agents) expect(a.seat.i).toBeLessThan(STATIONS[a.seat.st].seats.length);
    }
  });

  it('counts a skill call each time an agent starts using it', () => {
    const sim = new Simulation(mockData);
    const start = { ...sim.calls };
    const starts: Record<string, number> = {};
    const before = new Map(sim.agents.map((a) => [a.id, a.log[0]]));
    for (let i = 0; i < 400; i++) {
      sim.step(0.25);
      for (const a of sim.agents) {
        // a new log entry for a skill means the agent just started it
        const top = a.log[0];
        if (top !== before.get(a.id) && top.tool && mockData.skills[top.tool]) starts[top.tool] = (starts[top.tool] ?? 0) + 1;
        before.set(a.id, top);
      }
    }
    for (const id of Object.keys(mockData.skills)) expect(sim.calls[id] - start[id]).toBe(starts[id] ?? 0);
    expect(Object.values(starts).reduce((s, n) => s + n, 0)).toBeGreaterThan(0);
  });

  it('logs "Task complete" when an agent loops back to its first step', () => {
    const sim = new Simulation(mockData);
    sim.step(600);
    expect(sim.agents.some((a) => a.log.some((l) => l.k === 'done'))).toBe(true);
  });

  it('keeps each agent log to the latest 40 entries, newest first', () => {
    const sim = new Simulation(mockData);
    sim.step(1200);
    for (const a of sim.agents) {
      expect(a.log.length).toBeLessThanOrEqual(40);
      for (let i = 1; i < a.log.length; i++) expect(a.log[i - 1].t).toBeGreaterThanOrEqual(a.log[i].t);
    }
  });
});
