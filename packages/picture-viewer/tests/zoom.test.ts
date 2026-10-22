// The arithmetic of the viewer's pinch, double tap and drag (lifted from Postern's zoom.ts and its pinch scenario).
import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_SCALE, MAX_SCALE, MIN_SCALE, clampPan, clampScale, distance, panLimit, pinchScale } from '../src/zoom.js';

describe('zoom', () => {
  it('keeps a picture between its own size and six times it', () => {
    expect(MIN_SCALE).toBe(1);
    expect(MAX_SCALE).toBe(6);
    expect(clampScale(0.2)).toBe(1);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(20)).toBe(6);
  });

  it('a double tap zooms in to a scale inside the limits', () => {
    expect(DOUBLE_TAP_SCALE).toBeGreaterThan(MIN_SCALE);
    expect(DOUBLE_TAP_SCALE).toBeLessThan(MAX_SCALE);
  });

  it('measures the distance between two fingers', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('pinch: spreads to three times, stops at six, squeezes back to its own size', () => {
    expect(pinchScale(1, 100, 300)).toBe(3);
    expect(pinchScale(1, 100, 2000)).toBe(6);
    expect(pinchScale(3, 300, 30)).toBe(1);
  });

  it('pinch: fingers that started on the same spot ask for nothing new', () => {
    expect(pinchScale(2, 0, 50)).toBe(2);
  });

  it('pan: a picture may be dragged by its overhang and no further, none at its own size', () => {
    expect(panLimit(1, 400)).toBe(0);
    expect(panLimit(3, 400)).toBe(400);
    expect(clampPan(900, 3, 400)).toBe(400);
    expect(clampPan(-900, 3, 400)).toBe(-400);
    expect(clampPan(120, 3, 400)).toBe(120);
    expect(Math.abs(clampPan(50, 1, 400))).toBe(0);
  });
});
