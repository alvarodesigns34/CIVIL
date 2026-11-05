import { useEffect, useRef } from 'preact/hooks';
import { ctrl } from '../game/controller';
import { useStore } from '../game/store';
import { Title } from './Title';
import { TopBar, Rail, Toasts } from './Hud';
import { Alerts, ModeBar } from './Advisor';
import { TileCard } from './TileCard';
import { EventModal, ResultModal, GameOver, MenuPanel } from './Modals';
import { BuildPanel } from './panels/BuildPanel';
import { CitiesPanel } from './panels/CitiesPanel';
import { TechPanel } from './panels/TechPanel';
import { GovPanel } from './panels/GovPanel';
import { DiploPanel } from './panels/DiploPanel';
import { ChroniclePanel } from './panels/ChroniclePanel';

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
    default: return null;
  }
}

export function App() {
  useStore();
  if (ctrl.screen === 'title' || !ctrl.state) return <Title />;
  const panelOpen = !!ctrl.panel;
  const mobile = window.innerWidth <= 760;
  return (
    <>
      <MapView />
      <TopBar />
      <Rail />
      {!(mobile && panelOpen) && <Alerts />}
      {!(mobile && panelOpen) && <TileCard />}
      <ModeBar />
      <Panel />
      <Toasts />
      <EventModal />
      <ResultModal />
      <GameOver />
    </>
  );
}
