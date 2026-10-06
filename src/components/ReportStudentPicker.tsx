import type { Student } from '../cloud';
import { GRADE_LEVELS, gradeOf, matchesGrade } from '../gradeLevels';

export function ReportStudentPicker({ students, selected, grade, onGrade, onSelect }: {
  students: Student[]; selected: Student | null; grade: string;
  onGrade: (value: string) => void; onSelect: (student: Student | null) => void;
}) {
  const filtered = students.filter(student=>matchesGrade(student.class_name,grade));
  return <div className="report-picker-panel">
    <div className="report-picker-fields">
      <div className="report-grade-picker"><label htmlFor="report-grade">กรองชั้นเรียน</label><select id="report-grade" value={grade} onChange={event=>{
        const next=event.target.value;onGrade(next);
        if(selected && !matchesGrade(selected.class_name,next))onSelect(null);
      }}><option value="">ทุกชั้น</option>{GRADE_LEVELS.map(value=><option key={value} value={value}>{value}</option>)}{students.some(student=>!student.class_name?.trim()) && <option value="__none__">ยังไม่ระบุชั้น</option>}{students.some(student=>student.class_name?.trim() && !gradeOf(student.class_name)) && <option value="__other__">ข้อมูลชั้นอื่นเดิม</option>}</select></div>
      <div className="report-learner-picker"><label htmlFor="report-student">ผู้เรียนที่ต้องการดูรายงาน</label><select id="report-student" disabled={!filtered.length} value={filtered.some(student=>student.id===selected?.id)?selected!.id:''} onChange={event=>onSelect(filtered.find(student=>student.id===event.target.value) ?? null)}><option value="">{filtered.length?'เลือกผู้เรียน':'ยังไม่มีผู้เรียนในชั้นนี้'}</option>{filtered.map(student=><option key={student.id} value={student.id}>{student.display_name} · {student.code}{student.class_name ? ` · ${student.class_name}` : ''}</option>)}</select></div>
    </div>
    <p className="report-picker-count" role="status">{grade ? `พบ ${filtered.length} คนจากตัวกรองชั้นเรียน` : `ผู้เรียนทั้งหมด ${students.length} คน`}</p>
  </div>;
}
