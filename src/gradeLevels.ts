export const GRADE_LEVELS = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'] as const;
export type GradeLevel = typeof GRADE_LEVELS[number];
export function isGradeLevel(value: string): value is GradeLevel {
  return GRADE_LEVELS.some(grade=>grade===value);
}
// Keep previously entered room labels discoverable through their grade.
export function gradeOf(value?: string): GradeLevel | '' {
  const match = value?.trim().match(/^ป\.?\s*([1-6])(?:\s*\/\s*[0-9]+)?$/);
  return match ? `ป.${match[1]}` as GradeLevel : '';
}
export function matchesGrade(value: string | undefined, filter: string) {
  if (!filter) return true;
  if (filter==='__none__') return !value?.trim();
  if (filter==='__other__') return Boolean(value?.trim() && !gradeOf(value));
  return gradeOf(value)===filter;
}
