type Cue = 'click' | 'success';
type Voice = { oscillator: OscillatorNode; gain: GainNode };

let context: AudioContext | null = null;
let generation = 0;
const voices = new Set<Voice>();

function getContext(): AudioContext | null {
  try {
    if (!context || context.state === 'closed') {
      const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return null;
      context = new Constructor();
    }
    return context;
  } catch { return null; }
}

function cancelVoices() {
  for (const voice of voices) {
    try {
      const now = context?.currentTime ?? 0;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      voice.oscillator.stop(now);
    } catch { /* The voice may already have ended. */ }
  }
  voices.clear();
}

function tone(ctx: AudioContext, frequency: number, when: number, duration: number, volume: number, endFrequency?: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, when);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, when + duration);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain); gain.connect(ctx.destination);
  const voice = { oscillator, gain };
  voices.add(voice);
  oscillator.onended = () => { voices.delete(voice); oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(when); oscillator.stop(when + duration + 0.02);
}

// Called only from user gestures. No autoplay, network, microphone or audio files.
export function playFeedbackSound(cue: Cue) {
  const request = ++generation;
  const ctx = getContext();
  if (!ctx) return;
  void (async () => {
    try {
      if (ctx.state !== 'running') await ctx.resume();
      if (request !== generation || ctx.state !== 'running') return;
      cancelVoices();
      const start = ctx.currentTime + 0.005;
      if (cue === 'click') tone(ctx, 640, start, 0.065, 0.035, 480);
      else {
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
          tone(ctx, frequency, start + i * 0.11, i === 3 ? 0.24 : 0.13, 0.055);
        });
      }
    } catch { /* Visual feedback remains available if audio is blocked. */ }
  })();
}

export function stopFeedbackSound() { generation += 1; cancelVoices(); }

export function disposeFeedbackSound() {
  stopFeedbackSound();
  const previous = context; context = null;
  if (previous && previous.state !== 'closed') void previous.close().catch(() => {});
}
