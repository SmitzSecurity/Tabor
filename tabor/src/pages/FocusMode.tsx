import { useState, useEffect, useRef } from 'react';
import { Zap, Timer, BookOpen, Layers, Check, X, Flame, RotateCcw } from 'lucide-react';
import { api, useAppStore } from '../store';

type GoalType = 'timer' | 'pages' | 'cards';

export function FocusMode() {
  const [goalType, setGoalType] = useState<GoalType>('timer');
  const [goalValue, setGoalValue] = useState(25);
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { setNotification } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PRESETS = [
    { label: '15 min', value: 15 },
    { label: '25 min', value: 25 },
    { label: '45 min', value: 45 },
    { label: '60 min', value: 60 },
  ];

  const start = async () => {
    const data = await api.post('/focus-sessions', {
      type: goalType,
      duration_minutes: goalType === 'timer' ? goalValue : 0,
      pages_goal: goalType === 'pages' ? goalValue : 0,
      flashcards_goal: goalType === 'cards' ? goalValue : 0,
    });
    setSessionId(data.id);
    setElapsed(0);
    setCompleted(false);
    setActive(true);
  };

  const stop = async (success = false) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setActive(false);
    if (sessionId) {
      await api.patch(`/focus-sessions/${sessionId}`, { completed: success });
    }
    if (success) {
      setCompleted(true);
      setNotification('Focus session complete! 🎉');
      api.patch('/profile', { study_activity: true });
    }
  };

  useEffect(() => {
    if (!active || goalType !== 'timer') return;
    intervalRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (next >= goalValue * 60) {
          stop(true);
          return goalValue * 60;
        }
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, goalType, goalValue]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const totalSeconds = goalValue * 60;
  const timerProgress = goalType === 'timer' ? (elapsed / totalSeconds) * 100 : 0;
  const remaining = totalSeconds - elapsed;

  const GOAL_TYPES: { type: GoalType; icon: typeof Timer; label: string; desc: string }[] = [
    { type: 'timer', icon: Timer, label: 'Timed Session', desc: 'Read for a set duration' },
    { type: 'pages', icon: BookOpen, label: 'Page Goal', desc: 'Complete a number of pages' },
    { type: 'cards', icon: Layers, label: 'Card Review', desc: 'Review a deck of flashcards' },
  ];

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Zap size={28} className="text-indigo-400" /> Focus Mode
        </h1>
        <p className="text-slate-400 mt-1">Minimize distractions. Maximize retention.</p>
      </div>

      {completed ? (
        <div className="glass rounded-2xl p-10 text-center space-y-5 animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <Check size={44} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
          <p className="text-slate-400">
            {goalType === 'timer' ? `You stayed focused for ${goalValue} minutes.` :
              goalType === 'pages' ? `Goal: ${goalValue} pages read.` :
              `Goal: ${goalValue} cards reviewed.`}
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={() => setCompleted(false)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium">
              <RotateCcw size={16} /> New Session
            </button>
          </div>
        </div>
      ) : active ? (
        <div className="glass rounded-2xl p-8 space-y-8 animate-fade-in">
          {/* Timer ring */}
          {goalType === 'timer' && (
            <div className="relative w-48 h-48 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="rgba(99,102,241,0.15)" strokeWidth="8" fill="none" />
                <circle
                  cx="50" cy="50" r="42"
                  stroke="#6366f1"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - timerProgress / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-mono font-bold text-white">{formatTime(remaining)}</span>
                <span className="text-xs text-slate-500 mt-1">remaining</span>
              </div>
            </div>
          )}

          {goalType !== 'timer' && (
            <div className="text-center">
              <p className="text-6xl font-bold text-white">{goalValue}</p>
              <p className="text-slate-400 mt-2">{goalType === 'pages' ? 'pages to read' : 'cards to review'}</p>
              <p className="text-sm text-slate-500 mt-4">Mark complete when done</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => stop(true)}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <Check size={18} /> Complete
            </button>
            <button
              onClick={() => stop(false)}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <X size={18} /> Cancel
            </button>
          </div>

          <p className="text-center text-xs text-slate-600">
            Focus session active — stay off other apps!
          </p>
        </div>
      ) : (
        <>
          {/* Goal type selection */}
          <div className="grid grid-cols-3 gap-3">
            {GOAL_TYPES.map(({ type, icon: Icon, label, desc }) => (
              <button
                key={type}
                onClick={() => setGoalType(type)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  goalType === type
                    ? 'border-indigo-500 bg-indigo-600/20'
                    : 'border-white/10 bg-white/3 hover:bg-white/5'
                }`}
              >
                <Icon size={20} className={goalType === type ? 'text-indigo-400' : 'text-slate-500'} />
                <p className={`text-sm font-medium mt-2 ${goalType === type ? 'text-white' : 'text-slate-300'}`}>{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>

          {/* Goal value */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <label className="text-sm font-medium text-slate-300">
              {goalType === 'timer' ? 'Duration (minutes)' : goalType === 'pages' ? 'Pages to read' : 'Cards to review'}
            </label>

            {goalType === 'timer' && (
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setGoalValue(value)}
                    className={`py-2 rounded-xl text-sm font-medium transition-all ${
                      goalValue === value ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4">
              <input
                type="range"
                min={goalType === 'timer' ? 5 : 1}
                max={goalType === 'timer' ? 120 : 100}
                value={goalValue}
                onChange={e => setGoalValue(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <div className="w-16 text-center bg-white/5 border border-white/10 rounded-xl py-1.5">
                <input
                  type="number"
                  value={goalValue}
                  onChange={e => setGoalValue(parseInt(e.target.value) || 1)}
                  className="w-full bg-transparent text-center text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Airlock section */}
          <div className="glass rounded-2xl p-6 border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-3">
              <Flame size={20} className="text-orange-400" />
              <h3 className="font-semibold text-white">Airlock Protocol</h3>
            </div>
            <p className="text-sm text-slate-400">
              Enable the Airlock to require completing a flashcard review before accessing your device freely. Configure this in Settings.
            </p>
          </div>

          <button
            onClick={start}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 shadow-lg shadow-indigo-900/40 transition-all hover:shadow-indigo-900/60 hover:-translate-y-0.5"
          >
            <Zap size={20} /> Start Focus Session
          </button>
        </>
      )}
    </div>
  );
}
