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
    case 'cat': art = <>
      <path d="M101 96 78 43l63 27m38 0 63-27-23 53" fill="#efc28b" stroke="#875f4b" strokeWidth="4" strokeLinejoin="round"/>
      <path d="m91 65 13 32 24-19m64 0 24 19 13-32" fill="#eaa6b4"/>
      <ellipse cx="160" cy="139" rx="84" ry="73" fill="#f5d1a0" stroke="#875f4b" strokeWidth="4"/>
      <path d="m144 69 4 22m24-22-4 22" stroke="#ce9966" strokeWidth="7" strokeLinecap="round"/>
      <circle cx="126" cy="127" r="8" fill="#423544"/><circle cx="194" cy="127" r="8" fill="#423544"/>
      <path d="m149 147 11 10 11-10Z" fill="#d78298"/><path d="M160 157v9m-20 0q10 13 20 0 10 13 20 0" fill="none" stroke="#875f4b" strokeWidth="4" strokeLinecap="round"/>
      <path d="m112 150-51-8m51 23-51 7m147-22 51-8m-51 23 51 7" stroke="#875f4b" strokeWidth="4" strokeLinecap="round"/>
    </>; break;
    case 'house': art = <>
      <path d="M76 111h168v111H76Z" fill="#fff0c8" stroke="#875f4b" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M53 113 160 33l107 80Z" fill="#eaa4b7" stroke="#875f4b" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M142 222v-74h43v74" fill="#ba94bf" stroke="#875f4b" strokeWidth="4"/>
      <path d="M94 137h30v33H94Zm110 0h24v33h-24Z" fill="#bce1dd" stroke="#875f4b" strokeWidth="4"/>
      <circle cx="174" cy="188" r="3" fill="#fffdf7"/><path d="M52 224h216" stroke="#8fb99a" strokeWidth="7" strokeLinecap="round"/>
    </>; break;
    case 'rice': art = <>
      <path d="M85 136q-10-41 28-43-1-36 34-26 21-30 42-2 34-13 35 24 29 9 14 47Z" fill="#fffdf7" stroke="#ae9b86" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M66 137h188q-10 72-94 72-84 0-94-72Z" fill="#abd5cf" stroke="#4f7c76" strokeWidth="4"/>
      <path d="M128 212h64" stroke="#4f7c76" strokeWidth="7" strokeLinecap="round"/>
      <path d="m119 113 8-3m20-17 8-3m23 12 8 3m18 17 8-3m-53 3 8 3" stroke="#d4c6b6" strokeWidth="4" strokeLinecap="round"/>
      <path d="M109 159q50 24 100 0" fill="none" stroke="#e3f3ec" strokeWidth="5" strokeLinecap="round"/>
    </>; break;
    case 'banana': art = <>
      <path d="M86 73q8 132 132 105 38-8 52-37-37 82-124 70-90-14-75-123Z" fill="#f7d577" stroke="#907338" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M112 70q-8 113 105 86 20-5 41-20-39 65-106 48Q79 166 99 72Z" fill="#ffe398" stroke="#907338" strokeWidth="4" strokeLinejoin="round"/>
      <path d="m83 78 7-25 20 4-6 20" fill="#9fbc82" stroke="#907338" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M103 103q-2 69 77 76" fill="none" stroke="#dfb84f" strokeWidth="4" strokeLinecap="round"/>
      <path d="m263 144 8-7m-50 45 8-3" stroke="#907338" strokeWidth="5" strokeLinecap="round"/>
    </>; break;
    case 'crow': art = <>
      <path d="m134 188-5 29m48-29 7 29m-72 2h29m30 0h30" stroke="#8b624d" strokeWidth="5" strokeLinecap="round"/>
      <path d="m189 145 65-35-17 66-35 10" fill="#665b7d" stroke="#423544" strokeWidth="4" strokeLinejoin="round"/>
      <ellipse cx="151" cy="149" rx="65" ry="53" fill="#665b7d" stroke="#423544" strokeWidth="4"/>
      <circle cx="113" cy="95" r="40" fill="#665b7d" stroke="#423544" strokeWidth="4"/>
      <path d="m77 90-32 16 32 12" fill="#efc471" stroke="#8b624d" strokeWidth="3" strokeLinejoin="round"/>
      <circle cx="103" cy="89" r="10" fill="#fffdf7"/><circle cx="102" cy="89" r="5" fill="#423544"/>
      <path d="M135 135q58-17 50 23-4 30-51 12" fill="#817499" stroke="#423544" strokeWidth="3"/>
    </>; break;
    case 'snake': art = <>
      <path d="M71 201h145q46-1 23-34-24-30-69-17-37 11-31 43" fill="none" stroke="#49715e" strokeWidth="38" strokeLinecap="round"/>
      <path d="M71 201h145q46-1 23-34-24-30-69-17-37 11-31 43" fill="none" stroke="#a2ccb1" strokeWidth="30" strokeLinecap="round"/>
      <path d="M154 161q13-31 7-71" fill="none" stroke="#49715e" strokeWidth="35" strokeLinecap="round"/>
      <path d="M154 161q13-31 7-71" fill="none" stroke="#a2ccb1" strokeWidth="27" strokeLinecap="round"/>
      <ellipse cx="159" cy="72" rx="40" ry="30" fill="#a2ccb1" stroke="#49715e" strokeWidth="4"/>
      <circle cx="145" cy="67" r="6" fill="#423544"/><circle cx="176" cy="67" r="6" fill="#423544"/>
      <path d="M146 84q14 12 27 0" stroke="#49715e" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="m158 113 9 7m-21 18 9 7m45 20 9 7m-42 19 9 7" stroke="#729a70" strokeWidth="5" strokeLinecap="round"/>
    </>; break;
    case 'eye': art = <>
      <path d="M40 123q120-119 240 0-120 119-240 0Z" fill="#fffdf7" stroke="#665171" strokeWidth="5"/>
      <circle cx="160" cy="123" r="45" fill="#a3d3c2" stroke="#496e5c" strokeWidth="4"/>
      <circle cx="160" cy="123" r="24" fill="#423544"/><circle cx="171" cy="111" r="9" fill="white"/>
      <path d="m91 77-8-14m51-3-3-16m57 16 3-16m43 33 8-14" stroke="#665171" strokeWidth="5" strokeLinecap="round"/>
    </>; break;
    case 'paint': art = <>
      <path d="M62 135c-5-88 145-117 190-57 28 37-20 44-24 70-6 37-113 75-143 37Z" fill="#ffebbb" stroke="#8c6947" strokeWidth="4"/>
      <circle cx="98" cy="117" r="17" fill="#e981a3"/><circle cx="144" cy="84" r="17" fill="#e7b14e"/>
      <circle cx="198" cy="86" r="17" fill="#7bbda4"/><circle cx="217" cy="135" r="17" fill="#83b5dc"/>
      <circle cx="147" cy="158" r="20" fill="#fffdf7" stroke="#8c6947" strokeWidth="4"/>
      <path d="m213 195 36-70" stroke="#665171" strokeWidth="13" strokeLinecap="round"/>
      <path d="m209 187-23 26q30 12 42-17Z" fill="#b88ec9" stroke="#665171" strokeWidth="3"/>
    </>; break;
    case 'crab': art = <>
      <path d="m99 151-40 17-17-13m57 10-31 33-23-5m174-42 40 17 17-13m-57 10 31 33 23-5" fill="none" stroke="#aa5b51" strokeWidth="7" strokeLinecap="round"/>
      <path d="M108 115 76 90m136 25 32-25" stroke="#aa5b51" strokeWidth="9" strokeLinecap="round"/>
      <path d="M76 100q-48 8-35-44l19 27 22-29q20 35-6 46m168 0q48 8 35-44l-19 27-22-29q-20 35 6 46" fill="#efa78d" stroke="#aa5b51" strokeWidth="4" strokeLinejoin="round"/>
      <ellipse cx="160" cy="148" rx="70" ry="48" fill="#efb092" stroke="#aa5b51" strokeWidth="4"/>
      <path d="M128 110V90m64 20V90" stroke="#aa5b51" strokeWidth="8" strokeLinecap="round"/>
      <circle cx="128" cy="85" r="12" fill="#fffdf7" stroke="#aa5b51" strokeWidth="3"/><circle cx="192" cy="85" r="12" fill="#fffdf7" stroke="#aa5b51" strokeWidth="3"/>
      <circle cx="128" cy="86" r="5" fill="#423544"/><circle cx="192" cy="86" r="5" fill="#423544"/>
      <path d="M144 157q16 19 32 0" fill="none" stroke="#aa5b51" strokeWidth="4" strokeLinecap="round"/>
    </>; break;
    case 'bear': art = <>
      <circle cx="95" cy="70" r="31" fill="#d6ad87" stroke="#8b624d" strokeWidth="4"/><circle cx="225" cy="70" r="31" fill="#d6ad87" stroke="#8b624d" strokeWidth="4"/>
      <circle cx="95" cy="70" r="17" fill="#f2d5b6"/><circle cx="225" cy="70" r="17" fill="#f2d5b6"/>
      <ellipse cx="160" cy="136" rx="92" ry="85" fill="#d6ad87" stroke="#8b624d" strokeWidth="4"/>
      <circle cx="125" cy="124" r="8" fill="#423544"/><circle cx="195" cy="124" r="8" fill="#423544"/>
      <ellipse cx="160" cy="161" rx="41" ry="32" fill="#f7e5cc"/>
      <path d="M147 145q13-9 26 0l-13 13Z" fill="#66493e"/><path d="M160 155v14m-20-3q20 20 40 0" fill="none" stroke="#66493e" strokeWidth="4" strokeLinecap="round"/>
    </>; break;
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
