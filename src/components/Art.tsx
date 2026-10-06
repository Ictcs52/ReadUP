export function BookFriend({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 320 280" aria-hidden="true">
    <ellipse cx="162" cy="245" rx="84" ry="11" fill="#d9dde7" />
    <path d="M100 207l-12 30m125-30 12 30" stroke="#9d174d" strokeWidth="12" strokeLinecap="round" />
    <path d="M74 141 44 165m202-24 28-23" stroke="#9d174d" strokeWidth="12" strokeLinecap="round" />
    <path d="M69 73q45-22 92 8 48-30 92-8v139q-43-22-92 7-49-29-92-7z" fill="#92d9cc" stroke="#9d174d" strokeWidth="4" strokeLinejoin="round" />
    <path d="M77 64q42-18 84 10 45-28 83-10v138q-42-17-83 9-42-26-84-9z" fill="#fffef5" stroke="#9d174d" strokeWidth="4" strokeLinejoin="round" />
    <path d="M161 74v137" stroke="#e7b8c9" strokeWidth="4" />
    <circle cx="126" cy="134" r="9" fill="#603744" /><circle cx="193" cy="134" r="9" fill="#603744" /><circle cx="129" cy="131" r="3" fill="white"/><circle cx="196" cy="131" r="3" fill="white"/>
    <ellipse cx="111" cy="151" rx="12" ry="7" fill="#f5aac5" /><ellipse cx="208" cy="151" rx="12" ry="7" fill="#f5aac5" />
    <path d="M144 155q17 20 34 0" stroke="#603744" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d="m80 208-13 28 23 2 8-25m108 0 8 25 23-2-13-28" fill="#efbb67" stroke="#9d174d" strokeWidth="3" strokeLinejoin="round"/>
    <path d="m249 37 5 12 13 2-10 9 2 13-11-6-12 6 3-13-10-9 14-2z" fill="#efbb67" />
    <path d="m49 60 3 8 9 2-7 6 2 9-8-4-8 4 2-9-7-6 9-2z" fill="#efbb67" />
    <path d="M136 35q3-15 12-11 10 2 2 15l-10 10z" fill="#e98db0" />
    <path d="M91 91h28m-28 12h20m73-12h35m-35 12h26" stroke="#e6ccd5" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

export function Illustration({ kind, label, className = '' }: { kind: string; label: string; className?: string }) {
  let art;
  switch (kind) {
    case 'fish': art = <>
      <path d="m204 104 60-36v115l-60-34" fill="#f59bbd" stroke="#874254" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="140" cy="123" rx="86" ry="63" fill="#e6b45e" stroke="#874254" strokeWidth="4" />
      <path d="m137 66 34-31 27 47m-61 99 28 32 29-43" fill="#f7cb7b" stroke="#874254" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="93" cy="109" r="8" fill="#423544" /><path d="M70 133q12 10 22 0" fill="none" stroke="#874254" strokeWidth="4" strokeLinecap="round" />
      <path d="m142 91-13 20 13 20-13 20" fill="none" stroke="#ce924a" strokeWidth="4" />
      <circle cx="40" cy="63" r="9" fill="#d1eae7" /><circle cx="58" cy="36" r="5" fill="#d1eae7" />
    </>; break;
    case 'chicken': art = <>
      <path d="M135 58q-26-48-33-17-16-17-19 3-25-5-13 25" fill="#d85b7e" stroke="#874254" strokeWidth="4" />
      <path d="m90 181-4 31m38-28 4 28m-57 1h28m18 0h29" stroke="#a66f37" strokeWidth="5" strokeLinecap="round" />
      <path d="m200 111 37-53 1 67 34-26-8 55-57 11" fill="#efb665" stroke="#874254" strokeWidth="4" strokeLinejoin="round" />
      <path d="M76 91q-12-43 27-43 35 0 40 43 84-1 85 59 0 56-83 45-75-1-69-104" fill="#fff8e8" stroke="#874254" strokeWidth="4" />
      <path d="m77 87-29 12 30 13" fill="#edb05b" stroke="#874254" strokeWidth="4" />
      <circle cx="101" cy="80" r="7" fill="#423544" /><path d="M145 127q49-17 45 18-7 29-45 16" fill="#f7d89d" stroke="#c99557" strokeWidth="4" />
    </>; break;
    case 'horse': art = <>
      <path d="m173 76 17-42 17 41" fill="#e7ae79" stroke="#874254" strokeWidth="4" strokeLinejoin="round" />
      <path d="M146 76q28-31 66 10l35 34q17 30-16 44l-39-2-4 48H99l13-101z" fill="#eac096" stroke="#874254" strokeWidth="4" />
      <path d="M146 76q-39 9-40 104l31-8 1-38 18-20z" fill="#8f5972" />
      <circle cx="192" cy="103" r="7" fill="#423544" /><circle cx="233" cy="140" r="4" fill="#874254" />
      <path d="m208 149 16 4" stroke="#874254" strokeWidth="4" strokeLinecap="round" />
      <path d="M123 205h63" stroke="#c38e64" strokeWidth="5" strokeLinecap="round" />
    </>; break;
    case 'boat': art = <>
      <path d="M155 37v135" stroke="#874254" strokeWidth="5" strokeLinecap="round" />
      <path d="m147 53-76 104h76zm17 12 75 94h-75z" fill="#e9abc2" stroke="#874254" strokeWidth="4" strokeLinejoin="round" />
      <path d="M56 171h205l-35 42H93z" fill="#e6b45e" stroke="#874254" strokeWidth="4" strokeLinejoin="round" />
      <path d="M41 224q19-14 39 0 20-14 40 0 20-14 40 0 20-14 40 0 20-14 40 0 20-14 40 0" stroke="#9dcac5" strokeWidth="5" fill="none" strokeLinecap="round" />
    </>; break;
    default: art = <>
      <path d="M69 188Q26 70 234 36q37 181-165 152" fill="#a7ccb3" stroke="#496e5c" strokeWidth="4" />
      <path d="m59 207 167-160m-123 117-10-52m47 17 59 5m-25-39-7-33" stroke="#496e5c" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="162" cy="151" r="5" fill="#496e5c" /><circle cx="188" cy="128" r="5" fill="#496e5c" />
    </>;
  }
  return <svg className={className} viewBox="0 0 320 250" role="img" aria-label={label}><title>{label}</title>{art}</svg>;
}
