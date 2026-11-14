import { describe, it, expect } from 'vitest';
import { createBar } from './bar.js';

describe('createBar', () => {
  it('keeps the value between 0 and 100', () => {
    const bar = createBar({ value: 95 });
    bar.change(+20);
    expect(bar.value).toBe(100);
    bar.change(-250);
    expect(bar.value).toBe(0);
  });

  it('returns the new value from change()', () => {
    const bar = createBar({ value: 50 });
    expect(bar.change(-10)).toBe(40);
  });

  it('fires "empty" once when the bar hits zero', () => {
    const bar = createBar({ value: 5 });
    let empties = 0;
    bar.on('empty', () => empties++);
    bar.change(-10);
    bar.change(-10);
    expect(empties).toBe(1);
  });

  it('fires "full" once when the bar reaches the top', () => {
    const bar = createBar({ value: 90 });
    let fulls = 0;
    bar.on('full', () => fulls++);
    bar.change(+20);
    bar.change(+5);
    expect(fulls).toBe(1);
  });

  it('tells listeners the value, the applied delta and the reason', () => {
    const bar = createBar({ value: 3 });
    const seen = [];
    bar.on('change', (e) => seen.push(e));
    bar.change(-10, 'working');
    expect(seen).toEqual([{ value: 0, before: 3, delta: -3, reason: 'working' }]);
  });

  it('logs every change with the value it started from', () => {
    const bar = createBar({ value: 40 });
    bar.change(-15, 'working');
    bar.change(+5, 'refill');
    expect(bar.log).toEqual([
      { before: 40, delta: -15, reason: 'working' },
      { before: 25, delta: 5, reason: 'refill' },
    ]);
  });

  it('does nothing when a change is clamped away', () => {
    const bar = createBar({ value: 100 });
    let changes = 0;
    bar.on('change', () => changes++);
    bar.change(+10);
    expect(changes).toBe(0);
    expect(bar.log).toEqual([]);
  });

  it('stops calling a listener after unsubscribe', () => {
    const bar = createBar({ value: 50 });
    let calls = 0;
    const off = bar.on('change', () => calls++);
    off();
    bar.change(-1);
    expect(calls).toBe(0);
  });

  it('set() jumps straight to a value and clears the log', () => {
    const bar = createBar({ value: 50 });
    bar.change(-10);
    bar.set(100);
    expect(bar.value).toBe(100);
    expect(bar.log).toEqual([]);
  });
});
