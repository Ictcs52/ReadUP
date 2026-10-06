import bank from './data/audio.json';
import type { Settings } from './types';
import { stopFeedbackSound } from './feedbackAudio';

const recordings = bank as Record<string, string | null>;
let currentAudio: HTMLAudioElement | null = null;
let generation = 0;

export function thaiVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices().filter(v => /^th(?:-|_)?/i.test(v.lang)) ?? [];
}

export function recordingCount() { return Object.values(recordings).filter(Boolean).length; }

export function stopLessonAudio() {
  generation += 1;
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.onended = null; currentAudio.onerror = null;
    currentAudio.pause(); currentAudio.removeAttribute('src'); currentAudio.load();
    currentAudio = null;
  }
}

export function playLessonAudio(text: string, settings: Settings, onMessage: (message: string) => void) {
  stopFeedbackSound(); stopLessonAudio();
  if (!settings.sound) { onMessage('ปิดเสียงอยู่ เปิดได้ในหน้าปรับการใช้งาน'); return; }
  const request = generation;
  const rate = Number.isFinite(settings.speechRate) ? Math.max(0.65, Math.min(1.1, settings.speechRate)) : 0.85;
  function deviceVoice() {
    if (request !== generation) return;
    const voices = thaiVoices();
    const voice = voices.find(v => v.voiceURI === settings.voiceURI) ?? voices.find(v => v.default) ?? voices.find(v => v.localService) ?? voices[0];
    if (!voice || !window.speechSynthesis) { onMessage('เครื่องนี้ไม่มีเสียงภาษาไทย ให้ผู้ดูแลอ่านตัวอย่าง หรือใช้ปุ่มช่วยได้'); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = 'th-TH'; utterance.rate = rate;
    utterance.pitch = 1; utterance.volume = 1;
    utterance.onend = () => { if (request === generation) onMessage('ฟังซ้ำได้ตามต้องการ'); };
    utterance.onerror = e => {
      if (request === generation && e.error !== 'interrupted' && e.error !== 'canceled') onMessage('เปิดเสียงไม่สำเร็จ ลองกดฟังอีกครั้ง หรือให้ผู้ดูแลอ่านให้ฟังได้');
    };
    onMessage('กำลังใช้เสียงภาษาไทยในเครื่อง');
    window.speechSynthesis.speak(utterance);
  }
  const file = settings.recordedFirst ? recordings[text] : null;
  // Lesson recordings are public teaching assets in this repository, not student audio.
  if (file && /^audio\/[\p{L}\p{M}\p{N}_ -]+\.(mp3|wav|ogg|m4a)$/iu.test(file)) {
    try {
      const audio = new Audio(import.meta.env.BASE_URL + file.split('/').map(encodeURIComponent).join('/'));
      currentAudio = audio;
      audio.playbackRate = rate; audio.preservesPitch = true;
      let failed = false;
      const fallback = () => {
        if (failed || request !== generation) return;
        failed = true; audio.onerror = null; audio.pause();
        if (currentAudio === audio) currentAudio = null;
        deviceVoice();
      };
      audio.onerror = fallback;
      audio.onended = () => { if (request === generation) onMessage('ฟังซ้ำได้ตามต้องการ'); };
      onMessage('กำลังใช้ไฟล์เสียงบทเรียน');
      void audio.play().catch(fallback);
    } catch { deviceVoice(); }
  } else deviceVoice();
}
