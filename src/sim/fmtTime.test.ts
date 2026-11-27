import { describe, expect, it } from 'vitest';
import { fmtTime } from './simulation';

describe('fmtTime', () => {
  it('starts the clock at 09:12:00', () => {
    expect(fmtTime(0)).toBe('09:12:00');
  });

  it('pads and rolls over seconds, minutes and hours', () => {
    expect(fmtTime(5)).toBe('09:12:05');
    expect(fmtTime(48)).toBe('09:12:48');
    expect(fmtTime(60)).toBe('09:13:00');
    expect(fmtTime(48 * 60)).toBe('10:00:00');
  });

  it('drops fractions of a second', () => {
    expect(fmtTime(1.99)).toBe('09:12:01');
  });

  it('wraps past midnight', () => {
    expect(fmtTime(15 * 3600)).toBe('00:12:00');
  });
});
