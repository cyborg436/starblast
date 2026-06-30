'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   music.js  —  Procedural Web Audio music for StarBlast
   No external audio files. Lazy AudioContext init on first play().
───────────────────────────────────────────────────────────────────────── */

// ── Note-frequency helper ────────────────────────────────────────────────
const _S={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
function _hz(note,oct){ return 440*Math.pow(2,((oct+1)*12+_S[note]-69)/12); }
function n(s){ const m=s.match(/^([A-G][#b]?)(\d)$/); return m?_hz(m[1],+m[2]):0; }

// ── Track definitions — 16th-note step sequencer ─────────────────────────
// melody/bass/pad[i]: [freq, durationInSteps] to start note, or 0 for rest/hold
// drums.kick/snare/hihat[i]: 1 = trigger this step, 0 = skip

const TRACKS = {

  // ── ODYSSEY — Title screen, 90 BPM, A-minor, cinematic ──────────────
  odyssey: {
    bpm:90, steps:32,
    melody:[
      [n('E5'),6],0,0,0,0,0,[n('D5'),2],0,
      [n('C5'),4],0,0,0,[n('B4'),4],0,0,0,
      [n('A4'),8],0,0,0,0,0,0,0,
      [n('G4'),4],0,0,0,[n('A4'),4],0,0,0
    ],
    bass:[
      [n('A2'),16],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
      [n('F2'),8],0,0,0,0,0,0,0,[n('E2'),8],0,0,0,0,0,0,0
    ],
    pad:[
      [n('A3'),16],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
      [n('F3'),8],0,0,0,0,0,0,0,[n('E3'),8],0,0,0,0,0,0,0
    ],
    drums:{
      kick: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
      hihat:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]
    },
    vol:{melody:0.30,bass:0.40,pad:0.16,drums:0.44}
  },

  // ── AFTERBURN — Survival, 140→170 BPM, A-minor, frantic ─────────────
  afterburn: {
    bpm:140, steps:16,
    melody:[
      [n('A5'),1],[n('C5'),1],[n('E5'),1],[n('A5'),1],
      [n('G5'),2],0,[n('F5'),2],0,
      [n('E5'),1],[n('D5'),1],[n('C5'),1],[n('B4'),1],
      [n('A4'),2],0,[n('E5'),2],0
    ],
    bass:[
      [n('A2'),1],[n('A2'),1],[n('A2'),1],[n('G2'),1],
      [n('F2'),2],0,[n('E2'),2],0,
      [n('A2'),1],[n('A2'),1],[n('C3'),1],[n('A2'),1],
      [n('G2'),2],0,[n('E2'),2],0
    ],
    drums:{
      kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat:[1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0]
    },
    vol:{melody:0.36,bass:0.48,drums:0.62}
  },

  // ── FRONTIER — Story 1-3, 110 BPM, C-major, optimistic ──────────────
  frontier: {
    bpm:110, steps:32,
    melody:[
      [n('C5'),2],0,[n('E5'),2],0,[n('G5'),2],0,[n('E5'),2],0,
      [n('D5'),4],0,0,0,[n('F5'),2],0,[n('A5'),2],0,
      [n('G5'),4],0,0,0,[n('E5'),2],0,[n('G5'),2],0,
      [n('A5'),4],0,0,0,[n('G5'),4],0,0,0
    ],
    bass:[
      [n('C3'),4],0,0,0,[n('G2'),4],0,0,0,
      [n('A2'),4],0,0,0,[n('F2'),4],0,0,0,
      [n('C3'),4],0,0,0,[n('E2'),4],0,0,0,
      [n('F2'),4],0,0,0,[n('G2'),4],0,0,0
    ],
    drums:{
      kick: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
      snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0, 0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]
    },
    vol:{melody:0.34,bass:0.44,drums:0.54}
  },

  // ── TENSION — Story 4-6, 125 BPM, chromatic descent, menacing ────────
  tension: {
    bpm:125, steps:32,
    melody:[
      [n('A5'),2],0,[n('Ab5'),2],0,[n('G5'),2],0,[n('Gb5'),2],0,
      [n('F5'),4],0,0,0,[n('E5'),4],0,0,0,
      [n('Eb5'),2],0,[n('D5'),2],0,[n('Db5'),2],0,[n('C5'),2],0,
      [n('B4'),4],0,0,0,[n('A4'),4],0,0,0
    ],
    bass:[
      [n('A2'),4],0,0,0,[n('Ab2'),4],0,0,0,
      [n('G2'),4],0,0,0,[n('Gb2'),4],0,0,0,
      [n('F2'),4],0,0,0,[n('E2'),4],0,0,0,
      [n('Eb2'),4],0,0,0,[n('A2'),4],0,0,0
    ],
    drums:{
      kick: [1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0, 1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0],
      snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0, 0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0],
      hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    },
    vol:{melody:0.34,bass:0.48,drums:0.60}
  },

  // ── ASSAULT — Story 7-9, 155 BPM, fast & aggressive ─────────────────
  assault: {
    bpm:155, steps:16,
    melody:[
      [n('A5'),1],[n('A5'),1],[n('C6'),1],[n('A5'),1],
      [n('G5'),1],[n('A5'),1],[n('F5'),1],[n('G5'),1],
      [n('E5'),1],[n('F5'),1],[n('E5'),1],[n('D5'),1],
      [n('C5'),2],0,[n('E5'),2],0
    ],
    bass:[
      [n('A2'),2],0,[n('C3'),1],[n('A2'),1],
      [n('G2'),2],0,[n('G2'),1],[n('F2'),1],
      [n('A2'),2],0,[n('C3'),1],[n('A2'),1],
      [n('F2'),2],0,[n('E2'),2],0
    ],
    drums:{
      kick: [1,0,1,0,0,0,1,0,1,0,0,1,0,0,1,0],
      snare:[0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,0],
      hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    },
    vol:{melody:0.38,bass:0.50,drums:0.66}
  },

  // ── BOSSRUSH — Mode Boss Rush, 175 BPM, ultra-intense ────────────────
  bossrush: {
    bpm:175, steps:32,
    melody:[
      [n('A4'),1],[n('A4'),1],[n('A4'),1],[n('A4'),1],
      [n('C5'),2],0,[n('A4'),1],[n('G4'),1],
      [n('F4'),2],0,[n('E4'),1],[n('F4'),1],
      [n('G4'),2],0,[n('A4'),2],0,
      [n('A4'),1],[n('A4'),1],[n('Bb4'),1],[n('A4'),1],
      [n('G4'),2],0,[n('F4'),1],[n('Eb4'),1],
      [n('D4'),2],0,[n('Eb4'),1],[n('F4'),1],
      [n('A4'),4],0,0,0
    ],
    bass:[
      [n('A2'),1],[n('A2'),1],[n('A2'),1],[n('A2'),1],
      [n('A2'),2],0,[n('A2'),1],[n('A2'),1],
      [n('F2'),2],0,[n('F2'),1],[n('F2'),1],
      [n('G2'),2],0,[n('E2'),2],0,
      [n('A2'),1],[n('A2'),1],[n('A2'),1],[n('A2'),1],
      [n('Bb2'),2],0,[n('A2'),1],[n('A2'),1],
      [n('D3'),2],0,[n('Eb3'),1],[n('F3'),1],
      [n('A2'),4],0,0,0
    ],
    drums:{
      kick: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1],
      snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1, 0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,1],
      hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    },
    vol:{melody:0.40,bass:0.55,drums:0.74}
  },

  // ── NEMESIS — Boss fights, 160 BPM, dark & powerful ─────────────────
  nemesis: {
    bpm:160, steps:32,
    melody:[
      [n('A4'),2],0,[n('A4'),2],0,[n('G4'),2],0,[n('G4'),2],0,
      [n('F4'),4],0,0,0,[n('E4'),4],0,0,0,
      [n('Eb4'),2],0,[n('D4'),2],0,[n('Db4'),2],0,[n('C4'),2],0,
      [n('B3'),4],0,0,0,[n('A3'),4],0,0,0
    ],
    bass:[
      [n('A2'),4],0,0,0,[n('G2'),4],0,0,0,
      [n('F2'),4],0,0,0,[n('E2'),4],0,0,0,
      [n('Eb2'),4],0,0,0,[n('D2'),4],0,0,0,
      [n('C2'),4],0,0,0,[n('A2'),4],0,0,0
    ],
    drums:{
      kick: [1,0,0,1,0,0,1,0,1,0,0,0,1,0,0,0, 1,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0],
      snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0, 0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],
      hihat:[1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0, 1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0]
    },
    vol:{melody:0.34,bass:0.52,drums:0.70}
  }
};

// ── MusicManager ─────────────────────────────────────────────────────────
class MusicManager {
  constructor() {
    this._ctx      = null;
    this._master   = null;
    this._fadeNode = null;
    this._vol      = parseFloat(localStorage.getItem('sb_music_vol') ?? '0.35');
    this._muted    = localStorage.getItem('sb_music_muted') === '1';
    this._current  = null;
    this._timerId  = null;
    this._step     = 0;
    this._nextTime = 0;
    this._def      = null;
    this._bpm      = 120;
    this._elapsed  = 0;
    this._noiseCache = null;
  }

  // ── Public ──────────────────────────────────────────────────────────────
  play(trackName) {
    this._ensureCtx();
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(()=>{});
    if (this._current === trackName) return;
    this._crossFade(trackName);
  }

  stop() {
    if (!this._ctx) return;
    this._fadeOut(() => { this._stopSched(); this._current = null; this._def = null; });
  }

  get volume()    { return this._vol; }
  get muted()     { return this._muted; }

  setVolume(v) {
    this._vol = Math.max(0, Math.min(1, v));
    localStorage.setItem('sb_music_vol', this._vol);
    if (this._master && !this._muted)
      this._master.gain.setTargetAtTime(this._vol, this._ctx.currentTime, 0.06);
  }

  toggleMute() {
    this._muted = !this._muted;
    localStorage.setItem('sb_music_muted', this._muted ? '1' : '0');
    if (this._master) {
      const t = this._muted ? 0 : this._vol;
      this._master.gain.setTargetAtTime(t, this._ctx.currentTime, 0.06);
    }
    return this._muted;
  }

  // ── Context init ─────────────────────────────────────────────────────────
  _ensureCtx() {
    if (this._ctx) return;
    this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
    this._master = this._ctx.createGain();
    this._master.gain.value = this._muted ? 0 : this._vol;
    this._master.connect(this._ctx.destination);
  }

  // ── Crossfade ────────────────────────────────────────────────────────────
  _crossFade(name) {
    const hasCurrent = !!this._fadeNode;
    if (hasCurrent) {
      const g = this._fadeNode;
      const t = this._ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.8);
    }
    this._stopSched();
    setTimeout(() => this._startTrack(name), hasCurrent ? 820 : 0);
  }

  _fadeOut(cb) {
    if (!this._fadeNode) { this._stopSched(); cb?.(); return; }
    const g = this._fadeNode, t = this._ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.9);
    this._stopSched();
    setTimeout(cb, 950);
  }

  // ── Track start ──────────────────────────────────────────────────────────
  _startTrack(name) {
    this._current = name;
    this._step    = 0;
    this._elapsed = 0;

    if (name === 'triumph') { this._playTriumph(); return; }

    const def = TRACKS[name];
    if (!def) return;
    this._def  = def;
    this._bpm  = def.bpm;

    if (this._fadeNode) { try { this._fadeNode.disconnect(); } catch(e){} }
    const g = this._ctx.createGain();
    g.gain.setValueAtTime(0, this._ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, this._ctx.currentTime + 1.0);
    g.connect(this._master);
    this._fadeNode = g;

    this._nextTime = this._ctx.currentTime + 0.05;
    this._tick();
    this._timerId = setInterval(() => this._tick(), 100);
  }

  _stopSched() {
    if (this._timerId) { clearInterval(this._timerId); this._timerId = null; }
  }

  // ── Scheduler tick ───────────────────────────────────────────────────────
  _tick() {
    if (!this._def || !this._fadeNode) return;
    const LOOK = 0.22; // seconds to schedule ahead
    while (this._nextTime < this._ctx.currentTime + LOOK) {
      const stepDur = (60 / this._bpm) / 4; // one 16th note
      this._schedStep(this._step, this._nextTime, stepDur);
      this._nextTime += stepDur;
      this._elapsed += stepDur;
      this._step = (this._step + 1) % this._def.steps;
      // Afterburn BPM ramp: +5 BPM per 2 minutes, max +30
      if (this._current === 'afterburn') {
        this._bpm = this._def.bpm + Math.min(30, Math.floor(this._elapsed / 120) * 5);
      }
    }
  }

  // ── Step scheduler ───────────────────────────────────────────────────────
  _schedStep(step, time, stepDur) {
    const def = this._def, out = this._fadeNode, v = def.vol || {};

    const mel = def.melody?.[step];
    if (mel && mel[0]) this._osc(mel[0],'square',time,mel[1]*stepDur*0.88,0.008,0.09,0.55,0.10,v.melody??0.32,out);

    const bas = def.bass?.[step];
    if (bas && bas[0]) this._osc(bas[0],'sawtooth',time,bas[1]*stepDur*0.92,0.004,0.14,0.72,0.08,v.bass??0.45,out,220);

    const pad = def.pad?.[step];
    if (pad && pad[0]) this._osc(pad[0],'sine',time,pad[1]*stepDur*0.97,0.18,0.22,0.80,0.30,v.pad??0.18,out);

    const dr = def.drums, dv = v.drums ?? 0.58;
    if (dr?.kick?.[step])  this._kick (time, dv*0.90, out);
    if (dr?.snare?.[step]) this._snare(time, dv*0.72, out);
    if (dr?.hihat?.[step]) this._hihat(time, dv*0.32, out);
  }

  // ── Synthesis primitives ─────────────────────────────────────────────────

  _osc(freq, type, t0, dur, atk, dec, sus, rel, gain, dest, lpfHz) {
    if (dur <= 0) return;
    const ctx = this._ctx;
    const a = Math.min(atk, dur * 0.12);
    const r = Math.min(rel, dur * 0.38);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + a);
    env.gain.linearRampToValueAtTime(gain * sus, t0 + a + Math.min(dec, dur - a - r));
    env.gain.setValueAtTime(gain * sus, t0 + dur - r);
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    if (lpfHz) {
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = lpfHz; flt.Q.value = 0.8;
      osc.connect(flt); flt.connect(env);
    } else {
      osc.connect(env);
    }
    env.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _kick(t0, gain, dest) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, t0);
    osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.09);
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
    osc.connect(env); env.connect(dest);
    osc.start(t0); osc.stop(t0 + 0.32);
    // click transient
    const ck = ctx.createOscillator(), ce = ctx.createGain();
    ck.type = 'sine'; ck.frequency.value = 900;
    ce.gain.setValueAtTime(gain * 0.28, t0);
    ce.gain.exponentialRampToValueAtTime(0.001, t0 + 0.018);
    ck.connect(ce); ce.connect(dest);
    ck.start(t0); ck.stop(t0 + 0.022);
  }

  _snare(t0, gain, dest) {
    const ctx = this._ctx;
    // Noise burst
    const src = ctx.createBufferSource();
    src.buffer = this._noise(0.22);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 2400; bpf.Q.value = 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19);
    src.connect(bpf); bpf.connect(env); env.connect(dest);
    src.start(t0); src.stop(t0 + 0.22);
    // Tone body
    const osc = ctx.createOscillator(), oe = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = 210;
    oe.gain.setValueAtTime(gain * 0.38, t0);
    oe.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    osc.connect(oe); oe.connect(dest);
    osc.start(t0); osc.stop(t0 + 0.11);
  }

  _hihat(t0, gain, dest) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise(0.09);
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 7500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    src.connect(hpf); hpf.connect(env); env.connect(dest);
    src.start(t0); src.stop(t0 + 0.09);
  }

  _noise(dur) {
    const ctx = this._ctx, sr = ctx.sampleRate, frames = Math.ceil(sr * dur);
    const buf = ctx.createBuffer(1, frames, sr), d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Triumph one-shot fanfare (≈8 seconds) ────────────────────────────────
  _playTriumph() {
    this._ensureCtx();
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(()=>{});

    if (this._fadeNode) { try { this._fadeNode.disconnect(); } catch(e){} }
    const g = this._ctx.createGain();
    g.gain.setValueAtTime(0, this._ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, this._ctx.currentTime + 0.08);
    g.connect(this._master);
    this._fadeNode = g;

    const t = this._ctx.currentTime;
    // Rising arpeggio
    [
      [n('C4'),0.00,0.30],[n('E4'),0.12,0.30],[n('G4'),0.24,0.30],
      [n('C5'),0.36,0.50],[n('E5'),0.60,0.40],[n('G5'),0.80,0.40],
      [n('C6'),1.00,2.00],
      // Held chord
      [n('C4'),1.00,2.20],[n('E4'),1.00,2.20],[n('G4'),1.00,2.20],
      // Second flourish
      [n('G5'),3.40,0.25],[n('A5'),3.60,0.25],[n('B5'),3.80,0.25],
      [n('C6'),4.00,3.50],
      [n('C4'),4.00,3.50],[n('E4'),4.00,3.50],[n('G4'),4.00,3.50],[n('C5'),4.00,3.50]
    ].forEach(([freq,off,dur]) => this._osc(freq,'square',t+off,dur,0.01,0.12,0.75,0.20,0.45,g));

    // Triumphant kick hits on beat 1 and 3
    [0.36,1.00,4.00].forEach(off => this._kick(t+off, 0.7, g));

    setTimeout(() => {
      if (this._current === 'triumph') { this._current = null; this._def = null; }
    }, 8200);
  }
}

// ── Singleton export ─────────────────────────────────────────────────────
const musicManager = new MusicManager();
