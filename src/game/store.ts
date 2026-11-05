import { useEffect, useState } from 'preact/hooks';

type Fn = () => void;
const subs = new Set<Fn>();
let version = 0;
let scheduled = false;

export function notify() {
  version++;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    for (const f of subs) f();
  });
}

export function useStore(): number {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set(version);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return version;
}
