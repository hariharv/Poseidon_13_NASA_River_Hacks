// Sound effects, made in the browser with the Web Audio API (no audio files to download).
//   sound.play('click')             one-shot effects (see SOUNDS below)
//   const hum = sound.loop('hum')   looping beds; hum.set(0..1) changes loudness, hum.stop() ends it
//   sound.muted / sound.toggle()    remembered between visits
//   sound.music('calm' | 'tense' | 'title' | null)   the soundtrack (its own on/off: musicMuted / toggleMusic())
// Browsers only allow audio after a click or key press, so the audio context starts on the first one.

const KEY = 'olympus.muted';
const MUSIC_KEY = 'olympus.music-muted';

// The soundtrack: chords as MIDI notes, one chord per bar, in 16-bar sections that build up and settle:
//   bars 0-3 pads + bass, 4-7 + arpeggio, 8-11 + melody + soft drums, 12-15 + counter-melody, then round again.
// `scale` is what the melody and counter-melody pick from (a pentatonic, so it always sounds right).
const MOODS = {
  title: {
    bpm: 66,
    chords: [[57, 64, 67, 71], [53, 60, 64, 69], [48, 55, 59, 64], [55, 62, 66, 69], [57, 60, 64, 67], [53, 57, 60, 65], [50, 57, 60, 65], [52, 56, 59, 64]],
    scale: [69, 71, 72, 76, 79, 81, 84],
    sparkle: 0.5,
    drums: false,
  },
  calm: {
    bpm: 76,
    chords: [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 60, 62], [55, 59, 62, 67], [57, 60, 64, 69], [50, 53, 57, 62], [53, 57, 60, 65], [52, 55, 59, 64]],
    scale: [64, 67, 69, 72, 74, 76, 79],
    sparkle: 0.45,
    drums: 'soft',
  },
  tense: {
    bpm: 104,
    chords: [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 55], [45, 49, 52, 57]],
    scale: [62, 65, 67, 69, 72, 74],
    sparkle: 0.65,
    drums: 'drive',
    pulse: true,
  },
};

export function createSound(storage = safeStorage()) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = storage.get(KEY) === '1';
  let musicMuted = storage.get(MUSIC_KEY) === '1';
  let musicBus = null;
  let echo = null;
  let mood = null;
  let musicTimer = null;
  let nextBar = 0;
  let bar = 0;
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
    // music runs through its own gain and a soft echo, so it sits under the effects
    musicBus = ctx.createGain();
    musicBus.gain.value = musicMuted ? 0 : 0.32;
    echo = ctx.createDelay(1.5);
    echo.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    echo.connect(tone).connect(fb).connect(echo);
    tone.connect(musicBus);
    musicBus.connect(master);
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
    clap: () => {
      // a crowd clapping: lots of short, bright noise bursts that swell, then fade out
      const n = 110;
      for (let i = 0; i < n; i++) {
        const at = Math.random() * 3.0;
        const swell = at < 0.5 ? at / 0.5 : at > 2.2 ? Math.max(0, 1 - (at - 2.2) / 0.8) : 1;
        noise({ at, dur: 0.05 + Math.random() * 0.05, vol: (0.05 + Math.random() * 0.1) * swell + 0.004, freq: 900 + Math.random() * 1700, q: 0.9 });
      }
      // a couple of happy cheers on top
      tone({ type: 'triangle', from: 660, to: 990, at: 0.15, dur: 0.35, vol: 0.06 });
      tone({ type: 'triangle', from: 740, to: 1110, at: 0.9, dur: 0.4, vol: 0.05 });
    },
    flash: () => {
      noise({ dur: 1.4, vol: 0.18, type: 'lowpass', freq: 6000, toFreq: 300, q: 0.3 });
      tone({ type: 'sine', from: 2200, to: 300, dur: 1.1, vol: 0.06 });
    },
    thruster: () => noise({ dur: 0.22, vol: 0.16, type: 'bandpass', freq: 700, q: 1.4 }),
    star: () => tone({ type: 'sine', from: 1175, to: 1568, dur: 0.18, vol: 0.12 }),
    water: () => {
      // a little bloop + splash (water blobs, bubbles)
      tone({ type: 'sine', from: 320, to: 900, dur: 0.12, vol: 0.14 });
      tone({ type: 'sine', from: 500, to: 1300, at: 0.07, dur: 0.1, vol: 0.08 });
      noise({ at: 0.02, dur: 0.18, vol: 0.06, freq: 1400, q: 1.2 });
    },
  };

  // Looping beds: hum (machines), engine (rumble), air (fans), wind (water in the pool)
  const LOOPS = {
    hum: { type: 'tone', freq: 60, wave: 'sawtooth', filter: 220, vol: 0.05 },
    drill: { type: 'tone', freq: 118, wave: 'square', filter: 900, vol: 0.045 },
    servo: { type: 'tone', freq: 180, wave: 'sawtooth', filter: 700, vol: 0.035 },
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

  // ---------- the soundtrack ----------
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  function note(m, t0, dur, { type = 'triangle', vol = 0.1, attack = 0.02, toEcho = 0.5 } = {}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(musicBus);
    if (toEcho) {
      const e = ctx.createGain();
      e.gain.value = toEcho;
      g.connect(e).connect(echo);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
  function pad(chord, t0, dur) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t0);
    f.frequency.linearRampToValueAtTime(1300, t0 + dur * 0.5);
    f.frequency.linearRampToValueAtTime(600, t0 + dur);
    f.connect(musicBus);
    for (const m of chord) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(m);
        osc.detune.value = detune;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.018, t0 + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.6);
        osc.connect(g).connect(f);
        osc.start(t0);
        osc.stop(t0 + dur + 0.7);
      }
    }
  }
  // a little stereo spread: each part sits somewhere left-to-right
  function panned(pan) {
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = pan;
    p.connect(musicBus);
    return p;
  }
  // a soft flute-ish lead with a gentle wobble (vibrato)
  function lead(m, t0, dur, { vol = 0.06, pan = 0, type = 'sine' } = {}) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const vib = ctx.createOscillator();
    const vibAmt = ctx.createGain();
    osc.type = type;
    osc2.type = 'triangle';
    osc.frequency.value = hz(m);
    osc2.frequency.value = hz(m) * 2;
    vib.frequency.value = 5.2;
    vibAmt.gain.value = 9;
    vib.connect(vibAmt);
    vibAmt.connect(osc.detune);
    vibAmt.connect(osc2.detune);
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.06);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.07, dur * 0.7));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.25);
    osc.connect(g);
    osc2.connect(g2).connect(g);
    g.connect(panned(pan));
    const e = ctx.createGain();
    e.gain.value = 0.45;
    g.connect(e).connect(echo);
    for (const o of [osc, osc2, vib]) {
      o.start(t0);
      o.stop(t0 + dur + 0.3);
    }
  }
  function kick(t0, vol = 0.22) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.18);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(g).connect(musicBus);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  }
  function tickHat(t0, vol = 0.03, pan = 0.3, len = 0.04) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(f).connect(g).connect(panned(pan));
    src.start(t0, Math.random());
    src.stop(t0 + len + 0.02);
  }
  function brush(t0, vol = 0.05) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    src.connect(f).connect(g).connect(musicBus);
    src.start(t0, Math.random());
    src.stop(t0 + 0.25);
  }

  // The melody: a short theme (motif) made once per mood, then repeated with small changes,
  // so it sounds like a tune you could hum, not random notes.
  const RHYTHMS = [
    [1, 0.5, 0.5, 2],
    [1.5, 0.5, 1, 1],
    [0.5, 0.5, 1, 2],
    [2, 1, 1],
  ];
  let motif = null;
  function makeMotif(m) {
    const rhythm = RHYTHMS[Math.floor(Math.random() * RHYTHMS.length)];
    let idx = 2 + Math.floor(Math.random() * 2);
    const steps = rhythm.map(() => {
      idx = Math.max(0, Math.min(m.scale.length - 1, idx + [-1, 1, 1, -2, 2][Math.floor(Math.random() * 5)]));
      return idx;
    });
    return { rhythm, steps };
  }
  function playMotif(m, t0, beat, { shift = 0, vary = false, vol = 0.055, pan = -0.15, octave = 0 } = {}) {
    let t = t0;
    motif.rhythm.forEach((len, i) => {
      let k = motif.steps[i] + shift;
      if (vary && i === motif.rhythm.length - 1) k += Math.random() < 0.5 ? 1 : -1; // a new ending each time
      k = Math.max(0, Math.min(m.scale.length - 1, k));
      lead(m.scale[k] + octave, t, len * beat * 0.95, { vol, pan });
      t += len * beat;
    });
  }

  function scheduleBar(t0) {
    const m = MOODS[mood];
    const beat = 60 / m.bpm;
    const sec = bar % 16; // where we are in the 16-bar section
    const chord = m.chords[bar % m.chords.length];
    if (!motif || sec === 0) motif = makeMotif(m);

    // pads, always (a slightly different voicing every other bar so it breathes)
    pad(sec % 2 ? [chord[0], chord[2], chord[3], chord[1] + 12] : chord, t0, beat * 4);
    // bass: root on beat 1, a fifth on beat 3 (and a pulse when it's tense)
    note(chord[0] - 12, t0, beat * 1.8, { type: 'sine', vol: 0.12, attack: 0.04, toEcho: 0 });
    note(chord[0] - 5, t0 + beat * 2, beat * 1.6, { type: 'sine', vol: 0.08, attack: 0.04, toEcho: 0 });
    if (m.pulse) for (let i = 1; i < 8; i++) if (i !== 4) note(chord[0] - 12, t0 + i * beat * 0.5, beat * 0.4, { type: 'sine', vol: 0.06, toEcho: 0 });
    // arpeggio sparkles, from bar 4 of each section
    if (sec >= 4 || m.pulse) {
      const order = [0, 1, 2, 3, 2, 1, 3, 0];
      for (let i = 0; i < 8; i++) {
        if (Math.random() > m.sparkle + (sec >= 12 ? 0.15 : 0)) continue;
        const pick = chord[order[i]] + 12 * (i % 4 === 3 ? 2 : 1);
        note(pick, t0 + i * beat * 0.5, beat * 0.9, { type: 'triangle', vol: 0.03 + Math.random() * 0.025 });
      }
    }
    // the melody: bars 8-15 (the theme, then the theme with a new ending)
    if (sec >= 8 && sec % 2 === 0) playMotif(m, t0, beat, { vary: sec >= 12, shift: sec === 10 || sec === 14 ? 1 : 0 });
    // the counter-melody answers it an octave lower, from bar 12
    if (sec >= 12 && sec % 2 === 1) playMotif(m, t0 + beat * 0.5, beat, { shift: -2, vol: 0.035, pan: 0.35, octave: -12 });
    // a high shimmer at the start of each section
    if (sec === 0 || sec === 8) note(m.scale[m.scale.length - 1] + 12, t0, beat * 6, { type: 'sine', vol: 0.02, attack: 1.2 });

    // drums
    if (m.drums === 'soft' && sec >= 8) {
      kick(t0, 0.14);
      kick(t0 + beat * 2.5, 0.08);
      for (let i = 0; i < 4; i++) tickHat(t0 + i * beat + beat * 0.5, 0.018, 0.25);
      if (sec >= 12) brush(t0 + beat * 3, 0.035);
    } else if (m.drums === 'drive') {
      for (let i = 0; i < 4; i++) kick(t0 + i * beat, 0.16);
      for (let i = 0; i < 8; i++) tickHat(t0 + i * beat * 0.5 + beat * 0.25, 0.022, i % 2 ? 0.35 : -0.35);
      brush(t0 + beat, 0.06);
      brush(t0 + beat * 3, 0.06);
    }
    bar++;
    return t0 + beat * 4;
  }
  function musicTick() {
    if (!mood || !ctx || ctx.state !== 'running') return;
    if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.1;
    while (nextBar < ctx.currentTime + 0.6) nextBar = scheduleBar(nextBar);
  }

  const api = {
    // The soundtrack's mood. Safe before audio unlocks: it starts on the first click.
    music(next = null) {
      if (next === mood) return;
      mood = next && MOODS[next] ? next : null;
      bar = 0;
      if (mood && !musicTimer && typeof window !== 'undefined') musicTimer = setInterval(musicTick, 150);
      if (!mood && musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
      if (ctx) nextBar = Math.max(nextBar, ctx.currentTime + 0.05);
    },
    get musicMuted() {
      return musicMuted;
    },
    toggleMusic() {
      musicMuted = !musicMuted;
      storage.set(MUSIC_KEY, musicMuted ? '1' : '0');
      if (musicBus && ctx) musicBus.gain.setTargetAtTime(musicMuted ? 0 : 0.32, ctx.currentTime, 0.2);
      listeners.forEach((fn) => fn(muted));
      return musicMuted;
    },
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
