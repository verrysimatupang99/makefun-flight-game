// WebAudio sound, generated only: no audio files, no network.
// An engine hum whose pitch and loudness follow the throttle, a two-note
// chime for each ring, a low thud for a crash, a short fanfare for a landing.
export function createAudio() {
  const audio = {
    ctx: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    muted: false,
    started: false,
  };

  /** Start the audio graph on the first user gesture (browsers require it). */
  audio.start = function start() {
    if (audio.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineOsc.connect(audio.engineGain);
      audio.engineOsc.start();
      audio.engineOsc2 = audio.ctx.createOscillator();
      audio.engineOsc2.type = 'triangle';
      audio.engineOsc2.frequency.value = 110;
      const gain2 = audio.ctx.createGain();
      gain2.gain.value = 0.4;
      audio.engineOsc2.connect(gain2);
      gain2.connect(audio.engineGain);
      audio.engineOsc2.start();
      audio.started = true;
    } catch (error) {
      audio.ctx = null;
    }
  };

  /** Engine hum follows throttle (0..1) and airspeed; silent when parked. */
  audio.setEngine = function setEngine(throttle, speed, flying) {
    if (!audio.ctx || audio.muted) return;
    const target = flying ? 0.05 + throttle * 0.09 + Math.min(0.04, speed * 0.0004) : 0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
    const freq = 48 + throttle * 70 + speed * 0.25;
    audio.engineOsc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.1);
    audio.engineOsc2.frequency.setTargetAtTime(freq * 2, audio.ctx.currentTime, 0.1);
  };

  function tone(freq, at, duration, type, volume) {
    if (!audio.ctx || audio.muted) return;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume || 0.18, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  audio.ringChime = function ringChime() {
    if (!audio.ctx) return;
    const now = audio.ctx.currentTime;
    tone(880, now, 0.35, 'sine', 0.2);
    tone(1318.5, now + 0.09, 0.45, 'sine', 0.16);
  };

  audio.crashThud = function crashThud() {
    if (!audio.ctx) return;
    const now = audio.ctx.currentTime;
    tone(70, now, 0.5, 'triangle', 0.35);
    tone(45, now + 0.05, 0.6, 'sine', 0.3);
  };

  audio.landingFanfare = function landingFanfare() {
    if (!audio.ctx) return;
    const now = audio.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, now + i * 0.12, 0.4, 'triangle', 0.18));
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.engineGain) audio.engineGain.gain.value = audio.muted ? 0 : 0.05;
    return audio.muted;
  };

  return audio;
}
