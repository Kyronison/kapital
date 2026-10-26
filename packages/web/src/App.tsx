import { useEffect } from 'react';
import { Logo } from './art.js';
import { applyRules } from './content.js';
import { Game } from './components/Game.js';
import { Home } from './components/Home.js';
import { Lobby } from './components/Lobby.js';
import { useTable } from './net.js';

export function App() {
  const api = useTable();
  const { view, room } = api;
  applyRules(view?.mode);
  const screen = !room || !view ? 'home' : view.game ? 'game' : 'lobby';
  // новый экран открывается сверху, а не с прокруткой предыдущего
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
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
