import { Logo } from './art.js';
import { Game } from './components/Game.js';
import { Home } from './components/Home.js';
import { Lobby } from './components/Lobby.js';
import { useTable } from './net.js';

export function App() {
  const api = useTable();
  const { view, room } = api;
  const screen = !room || !view ? 'home' : view.game ? 'game' : 'lobby';
  return (
    <div className={`app screen-${screen}`}>
      <header className="top">
        <Logo />
        <span className="tagline">игра о пассивном доходе</span>
      </header>
      {api.error && (
        <div className="toast toast-in" role="alert" onClick={api.clearError}>
          {api.error}
        </div>
      )}
      {screen === 'home' ? <Home api={api} /> : screen === 'game' ? <Game api={api} view={view!} /> : <Lobby api={api} view={view!} />}
    </div>
  );
}
