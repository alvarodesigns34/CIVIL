// Definición del evento de crisis (sin depender del motor de eventos)
import type { EventDef } from '../sim/eventTypes';
import { civSettlements } from '../sim/world';

export const CRISIS_INFO: Record<string, { name: string; desc: string }> = {
  migration: { name: 'Las grandes migraciones', desc: 'Pueblos enteros huyen de algo que nadie ha visto. Los campamentos bárbaros se multiplican.' },
  bronze: { name: 'El colapso del bronce', desc: 'Las rutas del estaño se han roto. El comercio se hunde para quien no domine el hierro.' },
  plague: { name: 'La Gran Plaga', desc: 'Una enfermedad viaja con las caravanas y diezma las ciudades.' },
  ice: { name: 'La pequeña edad de hielo', desc: 'Inviernos largos y veranos fríos. Las cosechas menguan durante décadas.' },
};

export const CRISIS_EVENT: EventDef = {
  id: 'sys_crisis', title: 'Crisis', cat: 'disaster', art: 'storm', weight: 0, chainOnly: true, text: '', choices: [],
  build: (c) => {
    const k = String(c.data.kind);
    const info = CRISIS_INFO[k];
    const base = { title: info?.name ?? 'Crisis', text: `${info?.desc ?? ''} ¿Cómo responderá ${c.civ.name}?` };
    switch (k) {
      case 'migration':
        return { ...base, choices: [
          { label: 'Movilizar a los guerreros', hint: 'Más fuerza militar mientras dure la amenaza.', fx: [{ t: 'mod', id: 'cr_mig', name: 'Movilización', years: 35, fx: { military: 0.25, faction: { warriors: 6 } } }] },
          { label: 'Levantar empalizadas', hint: 'Todas las ciudades sin murallas reciben una empalizada.', fx: [{ t: 'custom', label: 'Empalizadas en todas tus ciudades', run: (k2) => { for (const s of civSettlements(k2.state, k2.civ.id)) s.fort = Math.max(1, s.fort); } }, { t: 'res', r: 'wood', v: -20, scale: 'era' }], ai: 2 },
          { label: 'Acoger a los refugiados', hint: 'Más gente, pero también más bocas y tensiones.', fx: [{ t: 'pop', v: 0.08, where: 'all' }, { t: 'stability', v: -6 }] },
        ] };
      case 'bronze':
        return { ...base, choices: [
          { label: 'Volcarse en el hierro', hint: 'Avanzar hacia la Siderurgia.', fx: [{ t: 'knowledge', v: 0.3 }, { t: 'faction', f: 'warriors', v: 4 }] },
          { label: 'Proteger a los mercaderes', hint: 'Oro para sostener las rutas.', fx: [{ t: 'res', r: 'gold', v: -15, scale: 'era' }, { t: 'faction', f: 'merchants', v: 12 }, { t: 'mod', id: 'cr_br', name: 'Rutas protegidas', years: 25, fx: { trade: 0.3 } }], ai: 2 },
          { label: 'Mirar hacia dentro', hint: 'Que cada aldea se baste a sí misma.', fx: [{ t: 'mod', id: 'cr_br2', name: 'Autarquía', years: 25, fx: { goods: 0.2, food: 0.05, trade: -0.2 } }] },
        ] };
      case 'plague':
        return { ...base, choices: [
          { label: 'Cuarentena estricta', hint: 'Cerrar las rutas comerciales diez años. La plaga casi no entrará.', fx: [{ t: 'custom', label: 'Rutas cerradas 10 años, contagio −75%', run: (k2) => { k2.civ.flags.quarantine = k2.year + 10; for (const r of Object.values(k2.civ.relations)) r.trade = false; for (const o of k2.state.civs) if (o.relations[k2.civ.id]) o.relations[k2.civ.id].trade = false; } }, { t: 'faction', f: 'merchants', v: -15 }], ai: 2 },
          { label: 'Médicos y hospitales', hint: 'Requiere Medicina. Cuesta oro, pero salva vidas.', req: (k2) => k2.has('medicine'), reqText: 'Requiere Medicina', fx: [{ t: 'res', r: 'gold', v: -25, scale: 'era' }, { t: 'mod', id: 'cr_med', name: 'Hospitales de la plaga', years: 30, fx: { health: 4 } }] },
          { label: 'Rogar a los dioses', hint: 'El clero lo agradece. La plaga, no tanto.', fx: [{ t: 'faction', f: 'clergy', v: 12 }, { t: 'stability', v: 4 }] },
        ] };
      case 'ice':
        return { ...base, choices: [
          { label: 'Llenar los graneros', hint: 'Racionar ahora para sobrevivir después.', fx: [{ t: 'mod', id: 'cr_ice', name: 'Graneros llenos', years: 40, fx: { food: 0.06, growth: -0.2 } }], ai: 2 },
          { label: 'Comerciar grano con el sur', hint: 'Oro a cambio de comida.', fx: [{ t: 'res', r: 'gold', v: -20, scale: 'era' }, { t: 'res', r: 'food', v: 30, scale: 'pop' }] },
          { label: 'Fiestas de invierno', hint: 'Que el frío no apague los ánimos.', fx: [{ t: 'stability', v: 8 }, { t: 'res', r: 'food', v: -8, scale: 'pop' }] },
        ] };
    }
    return base;
  },
};
