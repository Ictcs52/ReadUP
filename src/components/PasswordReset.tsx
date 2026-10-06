import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Icon } from './Icon';

export function PasswordReset({ client, initialEmail, onClose }: {
  client: SupabaseClient; initialEmail: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || sent) return;
    setBusy(true); setErrorMessage('');
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + import.meta.env.BASE_URL });
      if (error) {
        if (error.status === 429) throw new Error('ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง');
        if (error.code === 'email_address_not_authorized') throw new Error('ระบบยังส่งอีเมลให้บัญชีนี้ไม่ได้ กรุณาติดต่อผู้ดูแลเพื่อตั้งค่าการส่งอีเมล');
        throw new Error('ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อผู้ดูแล');
      }
      setSent(true);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="password-reset-dialog" aria-labelledby="password-reset-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="dialog-top"><h2 id="password-reset-title">ลืมรหัสผ่านครู</h2><button className="icon-button" aria-label="ปิดหน้าต่างลืมรหัสผ่าน" onClick={onClose}><Icon name="close"/></button></div>
    <p>กรอกอีเมลบัญชีครู เพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่</p>
    <form className="cloud-form" onSubmit={send}>
      <label>อีเมลสำหรับรับลิงก์<input type="email" autoFocus autoComplete="email" value={email} onChange={event=>{setEmail(event.target.value);setErrorMessage('');}} required disabled={busy || sent} placeholder="name@example.com"/></label>
      {errorMessage && <p className="cloud-message" role="alert">{errorMessage}</p>}
      {sent && <p className="reset-success" role="status">ส่งคำขอแล้ว หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์เปลี่ยนรหัสผ่านให้ กรุณาตรวจกล่องอีเมลและโฟลเดอร์สแปม</p>}
      <button className="primary" type="submit" disabled={busy || sent}>{busy ? 'กำลังส่งลิงก์…' : sent ? 'ส่งคำขอแล้ว' : 'ส่งลิงก์เปลี่ยนรหัสผ่าน'}<Icon name="arrow"/></button>
      <button className="text-button" type="button" onClick={onClose}>กลับเข้าสู่ระบบ</button>
    </form>
  </dialog>;
}
