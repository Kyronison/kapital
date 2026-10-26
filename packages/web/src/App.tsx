import { Game } from './components/Game.js';
import { Home } from './components/Home.js';
import { Lobby } from './components/Lobby.js';
import { useTable } from './net.js';

export function App() {
  const api = useTable();
  const { view, room } = api;
  return (
    <div className="app">
      <header className="top">
        <span className="logo">Капитал</span>
        <span className="tagline">игра о пассивном доходе</span>
      </header>
      {api.error && (
        <div className="toast" role="alert" onClick={api.clearError}>
          {api.error}
        </div>
      )}
      {!room || !view ? <Home api={api} /> : view.game ? <Game api={api} view={view} /> : <Lobby api={api} view={view} />}
    </div>
  );
}
