import { useEffect, useState } from 'react';
import { Logo } from './art.js';
import { restoreInvite, useAccount } from './auth.js';
import { resetProgress } from './campaign-progress.js';
import { applyRules } from './content.js';
import { Campaign } from './components/Campaign.js';
import { Game } from './components/Game.js';
import { Help } from './components/Help.js';
import { Lobby } from './components/Lobby.js';
import { Login } from './components/Login.js';
import { Play } from './components/Play.js';
import { Profile } from './components/Profile.js';
import { RatingPage } from './components/Rating.js';
import { Shell } from './components/Shell.js';
import { go, useTab } from './nav.js';
import { useTable } from './net.js';
import { loadRating, resetRating } from './rating.js';

export function App() {
  const api = useTable();
  const auth = useAccount();
  const tab = useTab();
  const { view, room } = api;
  applyRules(view?.mode, view?.level?.id);
  const signedIn = auth.state.status === 'in';
  const screen = auth.state.status === 'loading' ? 'loading'
    : !signedIn ? 'login'
    : !room || !view ? 'cabinet' : view.game ? 'game' : 'lobby';
  // после выхода из аккаунта комната и прогресс другого игрока не должны остаться на экране
  useEffect(() => {
    if (auth.state.status === 'out') {
      resetProgress();
      resetRating();
      if (api.room) api.leave();
    }
    // api меняется каждый рендер; важен только момент выхода
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.state.status]);
  // приглашение, отложенное на время входа через Яндекс или Google, открывается сразу после входа
  const [, setInvite] = useState(false);
  useEffect(() => {
    if (signedIn && restoreInvite()) setInvite(true);
  }, [signedIn]);
  // новый экран открывается сверху, а не с прокруткой предыдущего; после партии итоги в шапке свежие
  useEffect(() => {
    window.scrollTo(0, 0);
    if (screen === 'cabinet') void loadRating().catch(() => undefined);
  }, [screen, tab]);

  const name = auth.state.status === 'in' ? auth.state.account.user.name : '';
  const toTraining = () => {
    api.leave();
    go('training');
  };

  return (
    <div className={`app screen-${screen}`}>
      {screen !== 'cabinet' && (
        <header className="top">
          <Logo />
          <span className="tagline">игра о пассивном доходе</span>
        </header>
      )}
      {api.error && (
        <div className="toast toast-in" role="alert" onClick={api.clearError}>
          {api.error}
        </div>
      )}
      {screen === 'loading' ? null
        : screen === 'login' ? <Login auth={auth} invited={new URLSearchParams(location.search).has('room')} />
        : screen === 'game' ? <Game api={api} view={view!} onTraining={toTraining} />
        : screen === 'lobby' ? <Lobby api={api} view={view!} />
        : (
          <Shell tab={tab} name={name}>
            {tab === 'training' ? <Campaign api={api} />
              : tab === 'rating' ? <RatingPage />
              : tab === 'help' ? <Help api={api} />
              : tab === 'profile' ? <Profile auth={auth} />
              : <Play api={api} name={name} />}
          </Shell>
        )}
    </div>
  );
}
