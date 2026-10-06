export type Category = 'independent' | 'retried' | 'assisted' | 'skipped';
export type Question = { letter: string; word: string; speech: string; art: string; options: string[]; prompt?: string; promptSpeech?: string };
export type Lesson = { id: number; title: string; description: string; mode: string; questions: Question[] };
export type RecordResult = { questionIndex: number; letter: string; word: string; category: Category; wrongAttempts: number; hintLevel: number; activeMs: number };
export type Observation = { attention: string; reading: string; note: string };
export type Session = {
  id: string; lessonId: number; startedAt: number; endedAt?: number;
  status: 'active' | 'complete' | 'ended'; questionIndices: number[]; index: number;
  records: RecordResult[]; wrongAttempts: number; hintLevel: number; currentMs: number;
  answered: boolean; observation?: Observation;
};
export type Settings = { largeText: boolean; sound: boolean; effectsSound: boolean; slow: boolean; calm: boolean; voiceURI: string; speechRate: number; recordedFirst: boolean };
export type AppData = { version: 1; sessions: Session[]; settings: Settings };
