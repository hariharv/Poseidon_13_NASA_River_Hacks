// Sound effects, made in the browser with the Web Audio API (no audio files to download).
//   sound.play('click')             one-shot effects (see SOUNDS below)
//   const hum = sound.loop('hum')   looping beds; hum.set(0..1) changes loudness, hum.stop() ends it
//   sound.muted / sound.toggle()    remembered between visits
// Browsers only allow audio after a click or key press, so the audio context starts on the first one.

const KEY = 'olympus.muted';

export function createSound(storage = safeStorage()) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = storage.get(KEY) === '1';
  const loops = new Set();
  const listeners = new Set();

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // The first click or key press anywhere unlocks audio.
  if (typeof window !== 'undefined') {
    const unlock = () => {
      const c = ensure();
      if (c?.state === 'suspended') c.resume();
      if (c?.state === 'running') {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  // ---------- building blocks ----------
  function tone({ type = 'sine', from, to = from, at = 0, dur = 0.15, vol = 0.3, attack = 0.005 }) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  function noise({ at = 0, dur = 0.3, vol = 0.2, type = 'bandpass', freq = 1200, q = 0.8, toFreq = freq }) {
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (toFreq !== freq) f.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.02);
  }

  // ---------- the effects ----------
  const SOUNDS = {
    click: () => tone({ type: 'triangle', from: 900, to: 600, dur: 0.06, vol: 0.18 }),
    tap: () => tone({ type: 'sine', from: 520, to: 680, dur: 0.07, vol: 0.12 }),
    chirp: () => {
      // Zeus Jr. starts talking: a little robot "bip-bloop"
      tone({ type: 'square', from: 880, to: 1320, dur: 0.07, vol: 0.06 });
      tone({ type: 'square', from: 1320, to: 990, at: 0.08, dur: 0.08, vol: 0.05 });
    },
    beep: () => tone({ type: 'square', from: 1040, dur: 0.12, vol: 0.08 }),
    warn: () => {
      tone({ type: 'square', from: 740, dur: 0.16, vol: 0.09 });
      tone({ type: 'square', from: 740, at: 0.22, dur: 0.16, vol: 0.09 });
    },
    alarm: () => {
      // Master-alarm style two-tone
      for (let i = 0; i < 3; i++) {
        tone({ type: 'sawtooth', from: 660, at: i * 0.36, dur: 0.17, vol: 0.08 });
        tone({ type: 'sawtooth', from: 880, at: i * 0.36 + 0.18, dur: 0.17, vol: 0.08 });
      }
    },
    success: () => [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', from: f, at: i * 0.08, dur: 0.22, vol: 0.16 })),
    win: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, at: i * 0.11, dur: 0.35, vol: 0.18 }));
      tone({ type: 'sine', from: 1568, at: 0.46, dur: 0.6, vol: 0.08 });
    },
    fail: () => {
      tone({ type: 'triangle', from: 440, to: 330, dur: 0.3, vol: 0.16 });
      tone({ type: 'triangle', from: 330, to: 220, at: 0.28, dur: 0.45, vol: 0.16 });
    },
    whoosh: () => noise({ dur: 0.45, vol: 0.14, freq: 400, toFreq: 2400, q: 0.7 }),
    thud: () => {
      tone({ type: 'sine', from: 150, to: 60, dur: 0.18, vol: 0.3 });
      noise({ dur: 0.08, vol: 0.08, type: 'lowpass', freq: 900 });
    },
    clunk: () => {
      tone({ type: 'square', from: 210, to: 120, dur: 0.07, vol: 0.12 });
      noise({ at: 0.01, dur: 0.06, vol: 0.1, freq: 2400, q: 2 });
    },
    hiss: () => noise({ dur: 0.7, vol: 0.12, type: 'highpass', freq: 3500, q: 0.4 }),
    tick: () => noise({ dur: 0.012, vol: 0.25, type: 'highpass', freq: 5000, q: 0.5 }),
    flash: () => {
      noise({ dur: 1.4, vol: 0.18, type: 'lowpass', freq: 6000, toFreq: 300, q: 0.3 });
      tone({ type: 'sine', from: 2200, to: 300, dur: 1.1, vol: 0.06 });
    },
    thruster: () => noise({ dur: 0.22, vol: 0.16, type: 'bandpass', freq: 700, q: 1.4 }),
    star: () => tone({ type: 'sine', from: 1175, to: 1568, dur: 0.18, vol: 0.12 }),
  };

  // Looping beds: hum (machines), engine (rumble), air (fans), wind (water in the pool)
  const LOOPS = {
    hum: { type: 'tone', freq: 60, wave: 'sawtooth', filter: 220, vol: 0.05 },
    engine: { type: 'noise', freq: 140, q: 0.6, vol: 0.22 },
    air: { type: 'noise', freq: 2600, q: 0.3, vol: 0.05, filterType: 'highpass' },
    water: { type: 'noise', freq: 500, q: 0.4, vol: 0.06 },
  };

  function makeLoop(def) {
    const g = ctx.createGain();
    g.gain.value = 0;
    let src;
    if (def.type === 'tone') {
      src = ctx.createOscillator();
      src.type = def.wave;
      src.frequency.value = def.freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = def.filter;
      src.connect(f).connect(g);
    } else {
      src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = def.filterType ?? 'bandpass';
      f.frequency.value = def.freq;
      f.Q.value = def.q;
      src.connect(f).connect(g);
    }
    g.connect(master);
    src.start();
    return { src, g };
  }

  const api = {
    play(name) {
      if (muted || !SOUNDS[name] || !ensure() || ctx.state !== 'running') return;
      try {
        SOUNDS[name]();
      } catch {
        /* never let a sound break the game */
      }
    },
    // A looping sound. Safe to call before audio is unlocked: it starts once it can.
    loop(name, level = 1) {
      const def = LOOPS[name];
      let node = null;
      let want = level;
      let stopped = false;
      const handle = {
        set(v) {
          want = Math.max(0, Math.min(1, v));
          if (node && ctx) node.g.gain.setTargetAtTime(want * def.vol, ctx.currentTime, 0.15);
        },
        stop() {
          if (stopped) return;
          stopped = true;
          loops.delete(handle);
          if (node && ctx) {
            node.g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
            const n = node;
            setTimeout(() => {
              try {
                n.src.stop();
                n.g.disconnect();
              } catch {
                /* already stopped */
              }
            }, 400);
          }
        },
        _tryStart() {
          if (stopped || node || !def || !ensure() || ctx.state !== 'running') return;
          node = makeLoop(def);
          node.g.gain.setTargetAtTime(want * def.vol, ctx.currentTime, 0.3);
        },
      };
      loops.add(handle);
      handle._tryStart();
      return handle;
    },
    get muted() {
      return muted;
    },
    set muted(on) {
      muted = Boolean(on);
      storage.set(KEY, muted ? '1' : '0');
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
      listeners.forEach((fn) => fn(muted));
    },
    toggle() {
      api.muted = !muted;
      return muted;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  // Loops asked for before audio unlocked start as soon as it is.
  if (typeof window !== 'undefined') {
    const kick = () => loops.forEach((h) => h._tryStart());
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
  }

  return api;
}

function safeStorage() {
  return {
    get(k) {
      try {
        return globalThis.localStorage?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        globalThis.localStorage?.setItem(k, v);
      } catch {
        /* private window: just don't remember */
      }
    },
  };
}
