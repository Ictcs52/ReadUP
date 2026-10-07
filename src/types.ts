export type Category = 'independent' | 'retried' | 'assisted' | 'skipped';
export type Question = { letter: string; word: string; speech: string; art: string; options: string[]; prompt?: string; promptSpeech?: string; reading?: { text: string; question: string; hint: string; chunks?: string[]; pictureFirst?: boolean; optionArt?: Record<string,string>; parts?: string[] }; vowelExample?: boolean; vowelClue?: string; previousWord?: string; build?: { consonants: string[]; vowels: string[]; missing?: 'consonant' | 'vowel' | 'final'; baseWord?: string; finals?: string[] }; order?: string[]; blend?: { consonant: string; vowel: string; model: boolean } };
export type Lesson = { id: number; title: string; description: string; mode: string; questions: Question[] };
export type RecordResult = { questionIndex: number; letter: string; word: string; category: Category; wrongAttempts: number; hintLevel: number; activeMs: number; answeredAt?: number };
export type Observation = { attention: string; reading: string; note: string };
export type Session = {
  id: string; lessonId: number; startedAt: number; endedAt?: number;
  status: 'active' | 'complete' | 'ended'; questionIndices: number[]; index: number;
  records: RecordResult[]; wrongAttempts: number; hintLevel: number; currentMs: number;
  answered: boolean; observation?: Observation; breakAcknowledgedMs?: number;
  wordDraft?: { consonant: string; vowel: string; final?: string }; wordOrder?: string[];
  contentVersion?: number; localRevision?: number; cloudRevision?: number;
  syncedLocalRevision?: number; syncConflict?: boolean;
};
export type Settings = { largeText: boolean; sound: boolean; effectsSound: boolean; slow: boolean; calm: boolean; voiceURI: string; speechRate: number; recordedFirst: boolean; breakMinutes: 0 | 5 | 10 };
export type AppData = { version: 1; sessions: Session[]; settings: Settings };
