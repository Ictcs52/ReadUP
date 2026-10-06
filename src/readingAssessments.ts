import type { SupabaseClient } from '@supabase/supabase-js';

export type ReadingInput = {
  assessed_at: string; reading_text: string; correct_words: number; incorrect_words: number;
  letter_swaps: number; skipped_words: number; stops: number; reading_seconds: number | null;
  help_level: 'independent' | 'prompted' | 'guided' | 'full'; note: string;
};
export type ReadingAssessment = ReadingInput & { id: string; student_id: string; teacher_id: string; revision: number; created_at: string; updated_at: string };
const columns = 'id,student_id,teacher_id,assessed_at,reading_text,correct_words,incorrect_words,letter_swaps,skipped_words,stops,reading_seconds,help_level,note,revision,created_at,updated_at';

export async function fetchReadingAssessments(client: SupabaseClient, studentId: string): Promise<ReadingAssessment[]> {
  const { data, error } = await client.from('readtech_reading_assessments').select(columns).eq('student_id', studentId).order('assessed_at', { ascending: false }).order('id', { ascending: false });
  if (error) throw new Error('โหลดบันทึกการอ่านไม่สำเร็จ กรุณาลองอีกครั้ง');
  return data ?? [];
}

export async function saveReadingAssessment(client: SupabaseClient, studentId: string, teacherId: string, id: string, value: ReadingInput, revision?: number): Promise<ReadingAssessment> {
  const table = client.from('readtech_reading_assessments');
  const query = revision === undefined
    ? table.insert({ ...value, id, student_id: studentId, teacher_id: teacherId })
    : table.update(value).eq('id', id).eq('student_id', studentId).eq('revision', revision);
  const { data, error } = await query.select(columns).maybeSingle();
  // A lost response after an insert must not create another assessment on retry.
  if (error?.code === '23505' && revision === undefined) {
    const saved = await client.from('readtech_reading_assessments').select(columns).eq('id', id).eq('student_id', studentId).maybeSingle();
    const recorded = saved.data;
    if (!saved.error && recorded && Object.entries(value).every(([key, field]) => key === 'assessed_at' ? new Date(recorded.assessed_at).getTime() === new Date(String(field)).getTime() : recorded[key as keyof ReadingInput] === field)) return recorded;
  }
  if (error) throw new Error('บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง');
  if (!data) throw new Error('บันทึกนี้เปลี่ยนจากอีกเครื่อง หรือสิทธิ์บัญชีเปลี่ยนแล้ว กรุณาโหลดบันทึกล่าสุดก่อนแก้ไข');
  return data;
}
