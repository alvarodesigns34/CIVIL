// Iconos SVG propios, trazo de tinta.
const P: Record<string, string> = {
  food: 'M12 21V9M12 9c0-3 2-5 4-6-.2 3-1.6 5-4 6Zm0 0C12 6 10 4 8 3c.2 3 1.6 5 4 6Zm0 4c0-2.4 2-4.2 4.4-4.6-.3 2.6-2 4.3-4.4 4.6Zm0 0c0-2.4-2-4.2-4.4-4.6.3 2.6 2 4.3 4.4 4.6Zm0 4c0-2.4 2-4.2 4.4-4.6-.3 2.6-2 4.3-4.4 4.6Zm0 0c0-2.4-2-4.2-4.4-4.6.3 2.6 2 4.3 4.4 4.6Z',
  wood: 'M4 9.5 14.5 6a3 3 0 1 1 2 5.7L6 15.2A3 3 0 1 1 4 9.5Zm12.5 2.2a3 3 0 0 1-2-5.7M5.5 18.5l13-4M8 20l11-3.5a2 2 0 0 0-1.2-3.8',
  stone: 'M4 17l2.5-6.5L11 8l5 1.5 3.5 4.5L18 18H6.5L4 17Zm7-9 1 5 4-3.5M12 13l-5.5-2.5M12 13l1 5',
  metal: 'M3 16h18l-3-6H6l-3 6Zm3-6 2-4h8l2 4M3 16v2h18v-2',
  goods: 'M9 3h6M10 3v3c-3 1-5 3.5-5 7 0 4 3 8 7 8s7-4 7-8c0-3.5-2-6-5-7V3M6 12h12',
  gold: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12.5v9M14.5 10.2c-.4-.9-1.4-1.4-2.5-1.4-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.5 1.9-1.1 0-2.1-.5-2.5-1.4',
  influence: 'M4 18h16M5 18 3.5 8l5 4L12 5l3.5 7 5-4L19 18',
  knowledge: 'M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5Zm0 0v13',
  culture: 'M5 4h14v6a7 7 0 0 1-14 0V4Zm4 4.5h.01M15 8.5h.01M9 13c1.6 1.4 4.4 1.4 6 0',
  pop: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.6M18 14.3c1.8.8 3 2.7 3 5.7',
  stability: 'M12 4v16M5 20h14M4 8h16M7 8l-3 6a3 3 0 0 0 6 0L7 8Zm10 0-3 6a3 3 0 0 0 6 0l-3-6Z',
  health: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  military: 'M14.5 3.5H20v5.5L9 20l-3-3 11-11M4 16l4 4M3 21l2-2',
  build: 'M14 6l4 4M3 21l9-9M12.5 4.5l7 7-2.5 2.5-7-7 2.5-2.5Z',
  cities: 'M3 21h18M5 21V10l4-3 4 3v11M13 21V6l3-2 3 2v15M8 13h2M8 17h2M15 9h2M15 13h2M15 17h2',
  economy: 'M4 20V10M9 20V6M14 20v-8M19 20V4M3 20h18',
  tech: 'M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 14h9',
  gov: 'M4 18h16M5 18 3.5 8l5 4L12 5l3.5 7 5-4L19 18M4 21h16',
  diplo: 'M3 11l4-4 3 1 3-2 4 1 4 4M7 7l-4 8 3 3M21 11l-4 6-3 1M10 13l2 2M12 11l3 3M8 15l2 2M14 17l1 1',
  chronicle: 'M6 4h11a2 2 0 0 1 2 2v12M6 4a2 2 0 0 0-2 2v1h4M6 4a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1H10M11 8h5M11 11h5M11 14h3',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M7 5v14l11-7L7 5Z',
  pause: 'M8 5v14M16 5v14',
  fast: 'M4 6v12l8-6-8-6Zm8 0v12l8-6-8-6Z',
  faster: 'M2 6v12l6-6-6-6Zm7 0v12l6-6-6-6Zm7 0v12l6-6-6-6Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  warn: 'M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01',
  check: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z',
  up: 'M12 19V5M6 11l6-6 6 6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  hourglass: 'M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  save: 'M5 3h11l3 3v15H5V3Zm3 0v5h7V3M8 21v-7h8v7',
  sound: 'M4 9h4l5-4v14l-5-4H4V9Zm12 0c1.3 1.6 1.3 4.4 0 6m2.5-8.5c2.5 3 2.5 8 0 11',
  mute: 'M4 9h4l5-4v14l-5-4H4V9Zm12 1 5 5m0-5-5 5',
  scroll: 'M7 4h11a2 2 0 0 1 0 4H9M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M7 4a2 2 0 0 1 2 2v12M12 12h4M12 15h4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4c0 3 1.5 4.5 4 5M16 6h4c0 3-1.5 4.5-4 5M12 13v4M8 20h8M9 17h6',
  coin: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  arrows: 'M7 7h13l-3-3M17 17H4l3 3',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  sword: 'M14.5 3.5H20v5.5L9 20l-3-3 11-11M4 16l4 4M3 21l2-2',
};

export function Icon({ name, size, class: cls, style }: { name: string; size?: number; class?: string; style?: any }) {
  const d = P[name] ?? P.star;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={cls} style={style} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const RES_COLOR: Record<string, string> = {
  food: '#d9a83a', wood: '#a0743f', stone: '#a9a294', metal: '#8a97a3', goods: '#c4693e', gold: '#e2c044', influence: '#d46a52', knowledge: '#7f9ad0', culture: '#b67ac0',
};
