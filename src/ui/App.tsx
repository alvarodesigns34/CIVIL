import { useEffect, useRef } from 'preact/hooks';
import { ctrl } from '../game/controller';
import { useStore } from '../game/store';
import { Title } from './Title';
import { TopBar, Rail, Toasts } from './Hud';
import { Alerts, ModeBar } from './Advisor';
import { TileCard } from './TileCard';
import { EventModal, ResultModal, GameOver, MenuPanel, CodexPanel, ReportModal } from './Modals';
import { BuildPanel } from './panels/BuildPanel';
import { CitiesPanel } from './panels/CitiesPanel';
import { TechPanel } from './panels/TechPanel';
import { GovPanel } from './panels/GovPanel';
import { DiploPanel } from './panels/DiploPanel';
import { ChroniclePanel } from './panels/ChroniclePanel';
import { ObjectiveCard, Minimap, PausedBadge, LensBar } from './Extras';
import { civEra } from '../data/techs';
import { UnitCard } from './UnitCard';

function MapView() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    ctrl.attach(ref.current!);
  }, []);
  return (
    <div class="map-wrap">
      <canvas ref={ref} aria-label="Mapa del mundo" />
    </div>
  );
}

function Panel() {
  switch (ctrl.panel) {
    case 'build': return <BuildPanel />;
    case 'cities': return <CitiesPanel />;
    case 'tech': return <TechPanel />;
    case 'gov': case 'trad': return <GovPanel />;
    case 'diplo': return <DiploPanel />;
    case 'chronicle': return <ChroniclePanel />;
    case 'menu': return <MenuPanel />;
    case 'codex': return <CodexPanel />;
    default: return null;
  }
}

export function App() {
  useStore();
  if (ctrl.screen === 'title' || !ctrl.state) return <Title />;
  const panelOpen = !!ctrl.panel;
  const mobile = window.innerWidth <= 760;
  document.body.dataset.era = String(civEra(ctrl.player.techs));
  return (
    <>
      <MapView />
      <TopBar />
      <Rail />
      {!(mobile && panelOpen) && <Alerts />}
      {!(mobile && panelOpen) && <TileCard />}
      {!(mobile && panelOpen) && <UnitCard />}
      {!ctrl.overlay.selected && !(ctrl.overlay.selectedUnits?.length) && ctrl.overlay.mode === 'select' && !(mobile && panelOpen) && <ObjectiveCard />}
      {!panelOpen && <Minimap />}
      {!(mobile && panelOpen) && <LensBar />}
      {ctrl.overlay.mode === 'select' && !(mobile && (panelOpen || ctrl.overlay.selected)) && <PausedBadge />}
      <ModeBar />
      <Panel />
      <Toasts />
      <EventModal />
      <ResultModal />
      <ReportModal />
      <GameOver />
    </>
  );
}
