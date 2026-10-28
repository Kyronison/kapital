import { useEffect, useState } from 'react';
import { Logo } from './art.js';
import { restoreInvite, useAccount } from './auth.js';
import { resetProgress } from './campaign-progress.js';
import { applyRules } from './content.js';
import { Campaign } from './components/Campaign.js';
import { Game } from './components/Game.js';
import { Help } from './components/Help.js';
import { LegalFooter, LegalPage, useLegalDoc } from './components/Legal.js';
import { Lobby } from './components/Lobby.js';
import { Login } from './components/Login.js';
import { Play } from './components/Play.js';
import { Profile } from './components/Profile.js';
import { RatingPage } from './components/Rating.js';
import { Shell } from './components/Shell.js';
import { go, useTab } from './nav.js';
import { useTable } from './net.js';
import { loadRating, resetRating } from './rating.js';
import { goal, startMetrika } from './site.js';

export function App() {
  const api = useTable();
  const auth = useAccount();
  const tab = useTab();
  const legal = useLegalDoc();
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

  useEffect(() => {
    void startMetrika();
    if (new URLSearchParams(location.search).has('room')) goal('invite_opened');
  }, []);
  // цели воронки: вход, начало и конец партии или уровня
  const [wasOut, setWasOut] = useState(false);
  useEffect(() => {
    if (auth.state.status === 'out') setWasOut(true);
    if (signedIn && wasOut) goal('signed_in');
  }, [auth.state.status, signedIn, wasOut]);
  const level = view?.level?.id ?? null;
  useEffect(() => {
    if (screen === 'game') goal(level ? 'level_started' : 'game_started');
  }, [screen, level]);
  const finished = view?.game?.status === 'finished';
  const iWon = finished && view?.game?.winnerId === api.me;
  useEffect(() => {
    if (finished && !level) goal('game_finished');
    if (finished && level && iWon) goal('level_won');
  }, [finished, iWon, level]);

  const name = auth.state.status === 'in' ? auth.state.account.user.name : '';
  const avatar = auth.state.status === 'in' ? auth.state.account.user.avatar : null;
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
      {legal ? <LegalPage doc={legal} />
        : screen === 'loading' ? null
        : screen === 'login' ? <><Login auth={auth} invited={new URLSearchParams(location.search).has('room')} /><LegalFooter /></>
        : screen === 'game' ? <Game api={api} view={view!} onTraining={toTraining} />
        : screen === 'lobby' ? <Lobby api={api} view={view!} />
        : (
          <Shell tab={tab} name={name} avatar={avatar}>
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
