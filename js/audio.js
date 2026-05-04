window.BT = window.BT || {};

const PHONETIC = {
  B: 'bee', C: 'see', D: 'dee', F: 'eff', G: 'jee', H: 'aitch',
  J: 'jay', K: 'kay', L: 'el', M: 'em', N: 'en', P: 'pee',
  Q: 'cue', R: 'arr', S: 'ess', T: 'tee', V: 'vee', W: 'double-you',
  X: 'ex', Y: 'why', Z: 'zee'
};

const PREFERRED_VOICES = [
  'Samantha', 'Karen', 'Daniel', 'Moira', 'Tessa', 'Alex',
  'Google US English', 'Google UK English Female', 'Microsoft Aria Online',
  'Microsoft Jenny Online'
];

window.BT.Audio = {
  _voices: [],
  _voice: null,
  _ctx: null,
  _ready: false,

  init() {
    if ('speechSynthesis' in window) {
      const load = () => {
        this._voices = speechSynthesis.getVoices();
        this._voice = this._pickVoice();
      };
      load();
      if (!this._voices.length) {
        speechSynthesis.addEventListener('voiceschanged', load, { once: true });
      }
    }
    this._ready = true;
  },

  _pickVoice() {
    if (!this._voices.length) return null;
    const enVoices = this._voices.filter(v => v.lang.startsWith('en'));
    if (!enVoices.length) return this._voices[0];
    for (const name of PREFERRED_VOICES) {
      const match = enVoices.find(v => v.name.includes(name));
      if (match) return match;
    }
    const local = enVoices.find(v => v.localService);
    return local || enVoices[0];
  },

  speak(letter) {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const text = PHONETIC[letter.toUpperCase()] || letter.toLowerCase();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1.0;
      u.volume = 1.0;
      if (this._voice) u.voice = this._voice;
      speechSynthesis.speak(u);
    } else {
      this.beep(letter);
    }
  },

  beep(letter, durationMs = 150) {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = this._ctx;
    const freq = 200 + ((letter.charCodeAt(0) - 65) / 25) * 400;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  },

  tick() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }
};
