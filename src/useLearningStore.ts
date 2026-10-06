import { useEffect, useRef, useState } from 'react';
import { defaultData, loadData, saveData } from './storage';
import { fetchSessions, writeSession } from './cloud';
import { mergeCloudSessions, pendingSession, remoteSession } from './cloudDomain.mjs';
import type { CloudAccount } from './useCloudAccount';
import type { AppData, Session } from './types';

export function useLearningStore(account: CloudAccount) {
  const { config, client, teacher, student } = account;
  const cloud = Boolean(client && teacher && student && account.user?.id === teacher.id);
  const scope = cloud ? `workspace:${config!.url}:${teacher!.id}:${student!.id}` : 'snapshot';
  const [data, setData] = useState<AppData>(structuredClone(defaultData));
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const currentData = useRef(data);
  currentData.current = data;
  const trigger = useRef<() => Promise<void>>(async () => {});
  const loaded = loadedScope === scope;
  const pending = data.sessions.filter(pendingSession).length;
  const conflicts = data.sessions.filter(s => s.syncConflict).length;

  useEffect(() => {
    let alive = true;
    setLoadedScope(null); setSyncMessage(''); setStorageMessage(''); setSyncing(false);
    void (async () => {
      let local = structuredClone(defaultData);
      try { local = await loadData(scope); } catch { if (alive) setStorageMessage('เครื่องนี้บันทึกถาวรไม่ได้ กรุณาส่งออกผลก่อนปิดหน้านี้'); }
      if (cloud) {
        try {
          const remote = await fetchSessions(client!, student!.id);
          local = { ...local, sessions: mergeCloudSessions(local.sessions, remote) };
        } catch { if (alive) setSyncMessage('ยังโหลดผลกลางไม่ได้ ใช้ผลที่เก็บในเครื่องนี้ก่อน แล้วลองเชื่อมต่ออีกครั้ง'); }
      }
      if (alive) { setData(local); setLoadedScope(scope); }
    })();
    return () => { alive = false; };
  }, [scope]);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    saveData(data, scope).catch(() => { if (alive) setStorageMessage('ยังบันทึกลงเครื่องไม่ได้ กรุณาส่งออกผลก่อนปิดหน้านี้'); });
    return () => { alive = false; };
  }, [data, loaded, scope]);

  useEffect(() => {
    if (!loaded || !cloud) { trigger.current = async () => {}; return; }
    let alive = true;
    let busy = false;
    async function sync() {
      if (!alive || busy || !navigator.onLine) return;
      const writes = currentData.current.sessions.filter(s => pendingSession(s) && !s.syncConflict);
      if (!writes.length) return;
      busy = true; setSyncing(true);
      try {
        for (const snapshot of writes) {
          if (!alive) break;
          try {
            const saved = await writeSession(client!, student!.id, snapshot);
            if (!alive) break;
            setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === snapshot.id ? { ...s, cloudRevision: saved.revision, syncedLocalRevision: snapshot.localRevision ?? 0, syncConflict: false } : s) }));
            setSyncMessage('');
          } catch (error) {
            if (!alive) break;
            if ((error as { code?: string }).code === '40001') {
              setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === snapshot.id ? { ...s, syncConflict: true } : s) }));
              setSyncMessage('ผลกลางของรอบนี้เปลี่ยนแล้ว เก็บฉบับในเครื่องไว้แล้ว กรุณาส่งออก CSV ก่อนเลือกใช้ผลกลาง');
            } else {
              setSyncMessage('ยังส่งผลไม่สำเร็จ เก็บไว้ในเครื่องแล้ว ระบบจะลองส่งอีกครั้งเมื่อเชื่อมต่อได้');
              break;
            }
          }
        }
      } finally { busy = false; if (alive) setSyncing(false); }
    }
    trigger.current = sync;
    void sync();
    const timer = window.setInterval(() => void sync(), 5000);
    const reconnect = () => void sync();
    window.addEventListener('online', reconnect);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('online', reconnect); };
  }, [loaded, scope]);

  async function refreshCloud(replaceDrafts = false) {
    if (!cloud) return;
    if (pending && !replaceDrafts) throw new Error('มีผลในเครื่องรอส่ง กดส่งผลก่อน หรือส่งออก CSV แล้วเลือกใช้ผลกลาง');
    if (syncing) throw new Error('กำลังส่งผล กรุณารอสักครู่');
    const key = scope;
    const remote = await fetchSessions(client!, student!.id);
    // The component is reset on a scope change; the caller also disables switching during this request.
    if (key !== activeScope.current) return;
    setData(d => ({ ...d, sessions: replaceDrafts ? remote.map(remoteSession) : mergeCloudSessions(d.sessions, remote) }));
    setSyncMessage('');
  }
  const activeScope = useRef(scope); activeScope.current = scope;
  return { data, setData, loaded, scope, cloud, pending, conflicts, syncing, storageMessage, setStorageMessage, syncMessage, syncNow: () => trigger.current(), refreshCloud };
}

export function markChanged(session: Session): Session {
  return { ...session, localRevision: (session.localRevision ?? 0) + 1 };
}
