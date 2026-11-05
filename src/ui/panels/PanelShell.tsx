import type { ComponentChildren } from 'preact';
import { ctrl } from '../../game/controller';
import { notify } from '../../game/store';
import { sfx } from '../../game/audio';
import { Icon } from '../Icon';
import { cls } from '../util';

export function PanelShell({ title, sub, children, tabs, tab, onTab, wide, full }: {
  title: string; sub?: string; children: ComponentChildren; tabs?: { id: string; label: string }[]; tab?: string; onTab?: (t: string) => void; wide?: boolean; full?: boolean;
}) {
  return (
    <section class={cls('panel', wide && 'wide', full && 'full')} role="dialog" aria-label={title}>
      <div class="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <button class="close" onClick={() => { ctrl.panel = null; sfx('close', ctrl.settings); notify(); }} aria-label="Cerrar panel"><Icon name="close" /></button>
      </div>
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
