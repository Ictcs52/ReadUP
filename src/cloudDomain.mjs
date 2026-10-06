export function validateCloudConfig(url, key) {
  let parsed;
  try { parsed = new URL(url.trim()); } catch { throw new Error('กรอก Project URL ให้ถูกต้อง'); }
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) {
    throw new Error('ใช้ Project URL รูปแบบ https://ชื่อโปรเจกต์.supabase.co');
  }
  key = key.trim();
  let isPublic = /^sb_publishable_[a-zA-Z0-9_-]+$/.test(key);
  if (!isPublic && key.split('.').length === 3) {
    try { isPublic = JSON.parse(atob(key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))).role === 'anon'; } catch { /* Not a public key. */ }
  }
  if (!isPublic) throw new Error('ใช้ Publishable key หรือ anon key เท่านั้น ห้ามใช้ Secret หรือ service_role key');
  return { url: parsed.origin, publishableKey: key };
}

export function pendingSession(session) {
  return (session.localRevision ?? 0) > (session.syncedLocalRevision ?? 0);
}

export function cloudPayload(session) {
  const { localRevision, cloudRevision, syncedLocalRevision, syncConflict, ...payload } = session;
  return payload;
}

export function remoteSession(row) {
  return { ...row.payload, cloudRevision: row.revision, localRevision: 0, syncedLocalRevision: 0, syncConflict: false };
}

export function mergeCloudSessions(local, remote) {
  const map = new Map(local.map(s => [s.id, s]));
  for (const row of remote) {
    const cached = map.get(row.id);
    if (cached && pendingSession(cached)) {
      map.set(row.id, { ...cached, syncConflict: row.revision !== (cached.cloudRevision ?? 0) });
    } else map.set(row.id, remoteSession(row));
  }
  return [...map.values()].sort((a, b) => a.startedAt - b.startedAt);
}
