import React, { useState, useEffect } from 'react';
import QuizGame from './QuizGame.jsx';

// Definitions of default cities and tasks.  These mirror the backend values.
const DEFAULT_CITIES = [
  'Джохор',
  'Бангкок',
  'Куала Лумпур',
  'Сингапур',
  'Алматы',
  'Дубай',
  'Хошимин',
  'Манила',
  'Тайбэй',
];

const TASK_DEFS = [
  {
    id: 'subscribe',
    title: 'Подписаться на канал',
    reward: { keys: 1, tickets: 1, coins: 5 },
    needsCheck: true,
  },
  {
    id: 'pin_bot',
    title: 'Закрепить бота',
    reward: { keys: 1, tickets: 1, coins: 5 },
    needsCheck: false,
  },
  {
    id: 'invite_friend',
    title: 'Пригласить друга',
    reward: { keys: 1, tickets: 1, coins: 10 },
    needsCheck: false,
  },
  {
    id: 'send_route',
    title: 'Отправить маршрут',
    // Grant a coin bonus for sending your usual route.
    reward: { keys: 1, tickets: 1, coins: 5 },
    needsCheck: false,
  },
  {
    id: 'mini_quiz',
    title: 'Пройти мини‑квиз',
    // Mini‑quiz awards keys, tickets and coins.
    reward: { keys: 1, tickets: 1, coins: 10 },
    needsCheck: false,
  },
];

// Helper to load state from localStorage on first render
function loadInitialState() {
  try {
    const stored = localStorage.getItem('visa-run-full-state');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to parse local state', e);
  }
  // default state
  return {
    keys: 0,
    tickets: 0,
    coins: 0,
    cities: DEFAULT_CITIES.map((name) => ({ name, opened: false })),
    tasks: TASK_DEFS.map((t) => ({ id: t.id, done: false })),
  };
}

function App() {
  const [state, setState] = useState(loadInitialState);
  const [initData, setInitData] = useState(null);
  const [tgUser, setTgUser] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('visa-run-full-state', JSON.stringify(state));
    } catch {}
  }, [state]);

  // Detect Telegram WebApp environment
  useEffect(() => {
    const tw = window.Telegram && window.Telegram.WebApp;
    if (tw) {
      tw.ready();
      tw.expand();
      setInitData(tw.initData || null);
      try {
        setTgUser(tw.initDataUnsafe?.user || null);
      } catch {}
    }
  }, []);

  // Hydrate state from server if running inside Telegram
  useEffect(() => {
    const hydrate = async () => {
      if (!initData) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-initdata': initData,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data?.ok) {
          setState(data.state);
        }
      } catch (e) {
        console.warn('Failed to hydrate from server', e);
      }
    };
    hydrate();
  }, [initData]);

  // Grant rewards
  const earn = (reward) => {
    setState((s) => ({
      ...s,
      keys: s.keys + (reward.keys || 0),
      tickets: s.tickets + (reward.tickets || 0),
      coins: s.coins + (reward.coins || 0),
    }));
  };

  // Open a random unopened city
  const openRandomCity = async () => {
    if (state.keys <= 0) return;
    if (initData) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/city/open`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-initdata': initData,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data?.ok) {
          setState(data.state);
          return;
        }
      } catch (e) {
        console.warn('Failed to open city via server', e);
      }
    }
    // fallback local
    const unopened = state.cities
      .map((c, i) => ({ ...c, i }))
      .filter((c) => !c.opened);
    if (!unopened.length) return;
    const pick = unopened[Math.floor(Math.random() * unopened.length)];
    setState((s) => {
      const cities = s.cities.slice();
      cities[pick.i] = { ...cities[pick.i], opened: true };
      return { ...s, cities, keys: Math.max(0, s.keys - 1), tickets: s.tickets + 1 };
    });
  };

  // Complete a task locally or via server
  const completeTask = async (taskId, meta = {}) => {
    if (initData) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/task/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-initdata': initData,
          },
          body: JSON.stringify({ taskId, payload: meta }),
        });
        const data = await res.json();
        if (data?.ok) {
          setState(data.state);
          return;
        }
      } catch (e) {
        console.warn('Failed to complete task via server', e);
      }
    }
    // fallback local
    const def = TASK_DEFS.find((t) => t.id === taskId);
    if (!def) return;
    setState((s) => {
      // if already done, ignore
      if (s.tasks.find((t) => t.id === taskId)?.done) return s;
      const tasks = s.tasks.map((t) => (t.id === taskId ? { ...t, done: true, meta } : t));
      return { ...s, tasks };
    });
    earn(def.reward);
  };

  // Share referral link
  const shareReferral = async () => {
    const link = tgUser?.id
      ? `https://t.me/${import.meta.env.VITE_BOT_USERNAME || ''}?start=ref_${tgUser.id}`
      : window.location.href + '?ref=local';
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ВизаРан Бинго',
          text: 'Собери города и выиграй билет! Присоединяйся к игре.',
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        alert('Ссылка скопирована! Отправь её другу.');
      }
    } catch {}
  };

  // Send route prompt
  const handleSendRoute = async () => {
    const from = prompt('Откуда вы обычно летаете?');
    if (from) {
      await completeTask('send_route', { from });
    }
  };

  // When quiz finishes, call completeTask for mini_quiz if correct
  const handleQuizFinish = async (correct) => {
    if (correct) {
      await completeTask('mini_quiz');
    }
    setShowQuiz(false);
  };

  return (
    <div className="app">
      <h1>ВизаРан Бинго</h1>
      <div className="scoreboard">
        <div>Ключи: {state.keys}</div>
        <div>Билеты: {state.tickets}</div>
        <div>Монеты: {state.coins}</div>
      </div>

      <div className="grid">
        {state.cities.map((city, idx) => (
          <div
            key={idx}
            className={city.opened ? 'cell opened' : 'cell'}
          >
            {city.opened ? city.name : '❓'}
          </div>
        ))}
      </div>

      <button
        className="open-city-btn"
        onClick={openRandomCity}
        disabled={state.keys <= 0}
      >
        Открыть город (ключей: {state.keys})
      </button>

      <div className="tasks">
        {TASK_DEFS.map((def) => {
          const task = state.tasks.find((t) => t.id === def.id);
          const done = task?.done;
          return (
            <div key={def.id} className={done ? 'task done' : 'task'}>
              <span>
                {done ? '✅' : '⬜'} {def.title}
              </span>
              {!done && def.id === 'subscribe' && (
                <button onClick={() => completeTask('subscribe')}>Проверить</button>
              )}
              {!done && def.id === 'pin_bot' && (
                <button onClick={() => completeTask('pin_bot')}>Готово</button>
              )}
              {!done && def.id === 'invite_friend' && (
                <button onClick={shareReferral}>Пригласить</button>
              )}
              {!done && def.id === 'send_route' && (
                <button onClick={handleSendRoute}>Отправить</button>
              )}
              {!done && def.id === 'mini_quiz' && (
                <button onClick={() => setShowQuiz(true)}>Начать квиз</button>
              )}
            </div>
          );
        })}
      </div>

      {showQuiz && <QuizGame onFinish={handleQuizFinish} />}
    </div>
  );
}

export default App;
