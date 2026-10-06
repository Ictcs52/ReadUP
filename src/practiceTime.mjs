// Answered currentMs is already present in its result record; count it once.
export function practiceElapsed(session) {
  if (!session) return 0;
  return session.records.reduce((total,row)=>total+row.activeMs,0) + (session.answered?0:session.currentMs);
}
export function breakDue(session,minutes) {
  if (!session || session.status !== 'active' || ![5,10].includes(minutes)) return false;
  const acknowledged = Number.isFinite(session.breakAcknowledgedMs) && session.breakAcknowledgedMs >= 0 ? session.breakAcknowledgedMs : 0;
  return practiceElapsed(session)-acknowledged >= minutes*60000;
}
