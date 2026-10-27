import { useEffect, useState } from 'react';
import { Logo } from './art.js';
import { useAccount } from './auth.js';
import { resetProgress } from './campaign-progress.js';
import { applyRules } from './content.js';
import { Campaign } from './components/Campaign.js';
import { Game } from './components/Game.js';
import { Home } from './components/Home.js';
import { Lobby } from './components/Lobby.js';
import { Login } from './components/Login.js';
import { useTable } from './net.js';

export function App() {
  const api = useTable();
  const auth = useAccount();
  const { view, room } = api;
  applyRules(view?.mode, view?.level?.id);
  const [training, setTraining] = useState(false);
  const signedIn = auth.state.status === 'in';
  const screen = auth.state.status === 'loading' ? 'loading'
    : !signedIn ? 'login'
    : !room || !view ? (training ? 'campaign' : 'home') : view.game ? 'game' : 'lobby';
  // после выхода из аккаунта комната и прогресс другого игрока не должны остаться на экране
  useEffect(() => {
    if (auth.state.status === 'out') {
      resetProgress();
      setTraining(false);
      if (api.room) api.leave();
    }
    // api меняется каждый рендер; важен только момент выхода
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.state.status]);
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
      {screen === 'loading' ? null
        : screen === 'login' ? <Login auth={auth} invited={new URLSearchParams(location.search).has('room')} />
        : screen === 'home' ? <Home api={api} auth={auth} onTraining={() => setTraining(true)} />
        : screen === 'campaign' ? <Campaign api={api} onBack={() => setTraining(false)} />
        : screen === 'game' ? <Game api={api} view={view!} onTraining={() => { api.leave(); setTraining(true); }} />
        : <Lobby api={api} view={view!} />}
    </div>
  );
}
