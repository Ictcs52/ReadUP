const paths: Record<string, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h5v-7h4v7h5V9"/></>,
  book: <><path d="M12 5C9 3 5 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Z"/><path d="M12 5v16"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>,
  chart: <><path d="M4 3v18h17"/><path d="M8 16v-4m5 4V7m5 9v-6"/></>,
  sound: <><path d="m11 4-6 5H2v6h3l6 5Z"/><path d="M15 8q5 4 0 8m3-11q8 7 0 14"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  back: <><path d="M20 12H4m6-6-6 6 6 6"/></>,
  help: <><path d="M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  pause: <><path d="M8 5v14m8-14v14"/></>,
  replay: <><path d="M4 10a8 8 0 1 1 0 6M4 3v7h7"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></>,
  leaf: <><path d="M4 20C-2 8 10 2 21 3c1 11-6 21-17 17Z"/><path d="m3 22 14-14"/></>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
  letters: <text x="5" y="20" fill="currentColor" stroke="none" fontFamily="Noto Sans Thai, sans-serif" fontSize="23" fontWeight="600">ก</text>,
  puzzle: <path d="M3 3h6c-2 5 4 5 3 0h9v7c-5-2-5 4 0 3v8h-8c2-5-4-5-3 0H3v-8c5 2 5-4 0-3Z"/>,
  heart: <path d="M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6Z"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>
};
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.book}</svg>;
}
