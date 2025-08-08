import React, { useState, useEffect } from 'react';
import Grid from './components/Grid.jsx';
import TaskList from './components/TaskList.jsx';

// List of visa‑run destinations. Feel free to adjust or randomise
// these values as needed.
const DEFAULT_CITIES = [
  'Джохор',
  'Бангкок',
  'Куала Лумпур',
  'Сингапур',
  'Алматы',
  'Дубай',
  'Хошимин',
  'Манила',
  'Бишкек',
];

// Definitions for the available tasks. Each task has an ID, a display
// title and a reward specifying how many keys, tickets and coins the
// user receives upon completion. These IDs must match those used by
// the backend so the server knows which task is being completed.
const TASKS = [
  { id: 'subscribe', title: 'Подпишись на канал', reward: { keys: 1, tickets: 1, coins: 0 } },
  { id: 'pin', title: 'Добавь бота в закреп', reward: { keys: 1, tickets: 1, coins: 0 } },
  { id: 'invite', title: 'Пригласи друга', reward: { keys: 1, tickets: 1, coins: 0 } },
  { id: 'route', title: 'Отправь маршрут', reward: { keys: 1, tickets: 1, coins: 0 } },
  { id: 'quiz', title: 'Пройди мини‑квиз', reward: { keys: 1, tickets: 1, coins: 0 } },
];

function App() {
  // Local state holds the current cities, tasks and counters. When
  // running inside Telegram the server provides this state on first
  // load; otherwise it is initialised from localStorage.
  const [state, setState] = useState({
    cities: DEFAULT_CITIES.map((name) => ({ name, opened: false })),
    tasks: TASKS.map((t) => ({ ...t, done: false })),
    keys: 0,
    tickets: 0,
    coins: 0,
  });
  const [initData, setInitData] = useState(null);
  const [tgUser, setTgUser] = useState(null);

  // Detect whether the app is running inside a Telegram WebApp. If so,
  // call `ready()` and retrieve the init data and user info.
  useEffect(() => {
    const tw = window.Telegram && window.Telegram.WebApp;
    if (tw) {
      tw.ready();
      tw.expand();
      setInitData(tw.initData || null);
      try {
        setTgUser(tw.initDataUnsafe?.user || null);
      } catch {
        // ignore if initDataUnsafe is unavailable
      }
    }
  }, []);

  // Load state from localStorage when not running inside Telegram.
  useEffect(() => {
    if (!initData) {
      const stored = localStorage.getItem('vrbingo_state');
      if (stored) {
        try {
          setState(JSON.parse(stored));
        } catch {
          // ignore invalid JSON
        }
      }
    }
  }, [initData]);

  // Persist state to localStorage on change when not in Telegram.
  useEffect(() => {
    if (!initData) {
      localStorage.setItem('vrbingo_state', JSON.stringify(state));
    }
  }, [state, initData]);

  // Fetch the user state from the server when running inside Telegram. The
  // server verifies the init data and returns the current state for the user.
  useEffect(() => {
    const hydrate = async () => {
      if (!initData) return;
      const apiBase = import.meta.env.VITE_API_BASE;
      try {
        const res = await fetch(`${apiBase}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-initdata': initData,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data && data.state) {
          setState(data.state);
        }
      } catch (err) {
        console.error('Failed to hydrate state:', err);
      }
    };
    hydrate();
  }, [initData]);

  // Update the counters when a reward is earned locally.
  const earn = (reward) => {
    setState((s) => ({
      ...s,
      keys: s.keys + (reward.keys || 0),
      tickets: s.tickets + (reward.tickets || 0),
      coins: s.coins + (reward.coins || 0),
    }));
  };

  // Complete a task either by calling the backend (inside Telegram) or
  // updating the local state. Tasks cannot be completed more than once.
  const completeTask = async (taskId) => {
    const def = TASKS.find((t) => t.id === taskId);
    if (!def) return;
    const existing = state.tasks.find((t) => t.id === taskId);
    if (existing?.done) return;
    if (initData) {
      // call server to validate and update state
      const apiBase = import.meta.env.VITE_API_BASE;
      try {
        const res = await fetch(`${apiBase}/api/task/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-initdata': initData,
          },
          body: JSON.stringify({ taskId, payload: {} }),
        });
        const data = await res.json();
        if (data && data.state) {
          setState(data.state);
        }
      } catch (err) {
        console.warn('Task completion failed:', err);
      }
    } else {
      // local fallback
      setState((s) => {
        const tasks = s.tasks.map((t) => (t.id === taskId ? { ...t, done: true } : t));
        return { ...s, tasks };
      });
      earn(def.reward);
    }
  };

  // Open a random unopened city if the user has at least one key. Inside
  // Telegram we call the backend, otherwise pick locally and adjust counters.
  const openRandomCity = async () => {
    if (state.keys <= 0) return;
    if (initData) {
      const apiBase = import.meta.env.VITE_API_BASE;
      try {
        const res = await fetch(`${apiBase}/api/city/open`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-initdata': initData,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data && data.state) {
          setState(data.state);
        }
      } catch (err) {
        console.warn('Open city failed:', err);
      }
    } else {
      setState((s) => {
        const unopened = s.cities.map((c, i) => ({ ...c, i })).filter((c) => !c.opened);
        if (unopened.length === 0) return s;
        const pick = unopened[Math.floor(Math.random() * unopened.length)];
        const cities = s.cities.slice();
        cities[pick.i] = { ...cities[pick.i], opened: true };
        return { ...s, cities, keys: s.keys - 1, tickets: s.tickets + 1 };
      });
    }
  };

  // Share the referral link. When inside Telegram use the user ID to
  // construct a deep link; otherwise copy the current URL.
  const shareReferral = async () => {
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'your_bot';
    const link = tgUser?.id
      ? `https://t.me/${botUsername}?start=ref_${tgUser.id}`
      : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Visa Run Bingo',
          text: 'Присоединяйся ко мне в Visa Run Bingo!',
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        alert('Ссылка скопирована! Отправьте её другу.');
      }
    } catch (err) {
      console.log('Share failed:', err);
    }
  };

  return (
    <div className="app-container">
      <h1>Visa Run Bingo</h1>
      <div className="counters">
        <div>🔑 {state.keys}</div>
        <div>🎟 {state.tickets}</div>
        <div>🪙 {state.coins}</div>
      </div>
      <Grid cities={state.cities} />
      <button className="primary" onClick={openRandomCity} disabled={state.keys <= 0}>
        Открыть город
      </button>
      <TaskList tasks={state.tasks} onComplete={completeTask} />
      <button className="secondary" onClick={shareReferral}>
        Поделиться ссылкой
      </button>
    </div>
  );
}

export default App;
