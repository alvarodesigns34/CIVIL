import type { ComponentChildren } from 'preact';
import { ctrl } from '../../game/controller';
import { notify } from '../../game/store';
import { sfx } from '../../game/audio';
import { Icon } from '../Icon';
import { cls } from '../util';
import { EventArt } from '../EventArt';
import type { ArtKey } from '../../sim/eventTypes';

const ARTS: Record<string, string> = { Construir: 'harvest', Territorio: 'market', Saber: 'scroll', Gobierno: 'crown', Pueblos: 'envoy', Crónica: 'ruins', Menú: 'stars', Códice: 'temple' };
const ICONS: Record<string, string> = { Construir: 'build', Territorio: 'cities', Saber: 'tech', Gobierno: 'gov', Pueblos: 'diplo', Crónica: 'chronicle', Menú: 'menu', Códice: 'knowledge' };

export function PanelShell({ title, sub, children, tabs, tab, onTab, wide, full }: {
  title: string; sub?: string; children: ComponentChildren; tabs?: { id: string; label: string }[]; tab?: string; onTab?: (t: string) => void; wide?: boolean; full?: boolean;
}) {
  return (
    <section class={cls('panel', wide && 'wide', full && 'full')} role="dialog" aria-label={title}>
      <div class="panel-banner">
        <EventArt art={(ARTS[title] ?? 'stars') as ArtKey} seed={title.length * 97 + 13} />
        <div class="ptitle">
          {ICONS[title] && <span class="medallion"><Icon name={ICONS[title]} /></span>}
          <h2>{title}</h2>
        </div>
        <button class="close" onClick={() => { ctrl.panel = null; sfx('close', ctrl.settings); notify(); }} aria-label="Cerrar panel"><Icon name="close" /></button>
      </div>
      {sub && <div class="panel-sub">{sub}</div>}
      {tabs && (
        <div class="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === tab} class={cls(t.id === tab && 'on')} onClick={() => onTab?.(t.id)}>{t.label}</button>
          ))}
        </div>
      )}
      <div class="panel-body scroll">{children}</div>
    </section>
  );
}
