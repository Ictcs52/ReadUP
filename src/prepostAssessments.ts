import type {SupabaseClient} from '@supabase/supabase-js';
import {sameAssessment} from './prepostDomain.mjs';
export type Criterion={max_score:number;method:string};
export type Phase={scores:number[];assessed_at:string;reading_text:string;help_level:'independent'|'prompted'|'guided'|'full';correct_words:number|null;incorrect_words:number|null;letter_swaps:number|null;skipped_words:number|null;stops:number|null;reading_seconds:number|null;note:string;comparable:boolean};
export type PrePost={id:string;student_id:string;teacher_id:string;title:string;criteria:Criterion[];pre:Phase|null;post:Phase|null;revision:number;created_at:string;updated_at:string};
const columns='id,student_id,teacher_id,title,criteria,pre,post,revision,created_at,updated_at';
export async function fetchPrePost(client:SupabaseClient,studentId:string):Promise<PrePost[]>{const {data,error}=await client.from('readtech_prepost_assessments').select(columns).eq('student_id',studentId).order('created_at',{ascending:false}).order('id',{ascending:false});if(error)throw new Error('โหลดชุดประเมินไม่สำเร็จ กรุณาลองอีกครั้ง');return data??[];}
export async function createPrePost(client:SupabaseClient,studentId:string,teacherId:string,id:string,value:{title:string;criteria:Criterion[]}):Promise<PrePost>{
 const {data,error}=await client.from('readtech_prepost_assessments').insert({...value,id,student_id:studentId,teacher_id:teacherId}).select(columns).maybeSingle();
 if(error?.code==='23505'){const saved=await client.from('readtech_prepost_assessments').select(columns).eq('id',id).eq('student_id',studentId).maybeSingle();if(!saved.error&&saved.data&&saved.data.title===value.title&&sameAssessment(saved.data.criteria,value.criteria))return saved.data;}
 if(error||!data)throw new Error('สร้างชุดประเมินไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง');return data;
}
export async function savePhase(client:SupabaseClient,row:PrePost,stage:'pre'|'post',value:Phase):Promise<PrePost>{
 const {data,error}=await client.from('readtech_prepost_assessments').update({[stage]:value}).eq('id',row.id).eq('student_id',row.student_id).eq('revision',row.revision).select(columns).maybeSingle();
 if(error)throw new Error('บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง');
 if(!data){const saved=await client.from('readtech_prepost_assessments').select(columns).eq('id',row.id).eq('student_id',row.student_id).maybeSingle();if(!saved.error&&saved.data?.revision===row.revision+1&&sameAssessment(saved.data[stage],value))return saved.data;throw new Error('ชุดนี้เปลี่ยนจากอีกเครื่องหรือสิทธิ์เปลี่ยนแล้ว กรุณาโหลดชุดประเมินล่าสุด');}return data;
}
