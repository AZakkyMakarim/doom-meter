import { createSimulator } from './simulator';

const START = 1_700_000_000_000;

describe('debug simulator', () => {
  it('starts empty', () => {
    const sim = createSimulator({ startAt: START });
    expect(sim.getState().totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
    expect(sim.getState().tier).toBe(0);
  });

  it('adds Watched videos that also add Watch time', () => {
    const sim = createSimulator({ startAt: START });
    sim.addVideos(10);
    const state = sim.getState();
    expect(state.totals.watchedVideos).toBe(10);
    expect(state.totals.watchTimeMs).toBeGreaterThan(0);
    expect(state.tier).toBe(1);
  });

  it('adds Watch time without inflating the count much', () => {
    const sim = createSimulator({ startAt: START });
    sim.addMinutes(30);
    const state = sim.getState();
    expect(state.totals.watchTimeMs).toBe(30 * 60_000);
    expect(state.tier).toBe(2);
  });

  it('reaches every Tier by adding videos', () => {
    const sim = createSimulator({ startAt: START });
    const seen = new Set<number>();
    for (let i = 0; i < 130; i += 1) {
      sim.addVideos(1);
      seen.add(sim.getState().tier);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
