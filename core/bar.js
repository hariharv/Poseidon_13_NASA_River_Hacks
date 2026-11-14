// A 0-100 bar (Oxygen or Progress). Clamps, logs, and tells listeners.
// Events: 'change' ({ value, before, delta, reason }), 'empty', 'full'.

export function createBar({ value = 100, min = 0, max = 100 } = {}) {
  let current = clamp(value, min, max);
  let log = [];
  const listeners = { change: new Set(), empty: new Set(), full: new Set() };

  function emit(type, payload) {
    for (const fn of listeners[type]) fn(payload);
  }

  return {
    get value() {
      return current;
    },
    get log() {
      return log;
    },
    change(delta, reason) {
      const before = current;
      const after = clamp(before + delta, min, max);
      const applied = after - before;
      if (applied === 0) return current;
      current = after;
      log.push({ before, delta: applied, reason });
      emit('change', { value: current, before, delta: applied, reason });
      if (current === min && before > min) emit('empty');
      if (current === max && before < max) emit('full');
      return current;
    },
    set(next) {
      current = clamp(next, min, max);
      log = [];
      emit('change', { value: current, before: current, delta: 0, reason: 'set' });
      return current;
    },
    on(type, fn) {
      if (!listeners[type]) throw new Error(`Unknown bar event "${type}"`);
      listeners[type].add(fn);
      return () => listeners[type].delete(fn);
    },
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
