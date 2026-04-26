import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Zap, Brain, Bell, Shield, Layers } from 'lucide-react';
import { api, useAppStore } from '../store';

interface ProfileData {
  daily_card_goal: string;
  airlock_enabled: string;
  airlock_cards_required: string;
  focus_mode_enabled: string;
  theme: string;
  streak_days: string;
  total_cards_reviewed: string;
  total_pages_read: string;
}

export function Settings() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saved, setSaved] = useState(false);
  const { setNotification } = useAppStore();

  useEffect(() => {
    api.get('/profile').then(setProfile);
  }, []);

  const save = async (updates: Partial<ProfileData>) => {
    if (!profile) return;
    const merged = { ...profile, ...updates };
    setProfile(merged as ProfileData);
    await api.patch('/profile', updates);
    setNotification('Settings saved');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = (key: keyof ProfileData) => {
    if (!profile) return;
    const current = profile[key] === 'true';
    save({ [key]: String(!current) });
  };

  if (!profile) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <SettingsIcon size={28} className="text-slate-400" /> Settings
        </h1>
        <p className="text-slate-400 mt-1">Customize your Tabor experience</p>
      </div>

      {/* Airlock */}
      <section className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <Shield size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Airlock Protocol</h2>
            <p className="text-xs text-slate-500">Require flashcard review to unlock device access</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Enable Airlock</p>
            <p className="text-xs text-slate-500 mt-0.5">Must complete daily cards before free access</p>
          </div>
          <ToggleSwitch value={profile.airlock_enabled === 'true'} onChange={() => toggle('airlock_enabled')} />
        </div>

        {profile.airlock_enabled === 'true' && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div>
              <label className="text-sm text-slate-300 block mb-2">Cards required to unlock</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={parseInt(profile.airlock_cards_required)}
                  onChange={e => save({ airlock_cards_required: e.target.value })}
                  className="flex-1 accent-indigo-500"
                />
                <span className="text-indigo-400 font-bold w-8 text-right">{profile.airlock_cards_required}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Spaced Repetition */}
      <section className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-600/20 flex items-center justify-center">
            <Brain size={20} className="text-pink-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Spaced Repetition</h2>
            <p className="text-xs text-slate-500">SM-2 algorithm settings</p>
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-300 block mb-2">Daily card goal</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="5"
              max="100"
              value={parseInt(profile.daily_card_goal)}
              onChange={e => save({ daily_card_goal: e.target.value })}
              className="flex-1 accent-pink-500"
            />
            <span className="text-pink-400 font-bold w-8 text-right">{profile.daily_card_goal}</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">Cards per day for maximum retention</p>
        </div>
      </section>

      {/* Focus */}
      <section className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center">
            <Zap size={20} className="text-orange-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Focus Mode</h2>
            <p className="text-xs text-slate-500">Reading environment settings</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Enable Focus Mode by default</p>
            <p className="text-xs text-slate-500 mt-0.5">Launch reader in distraction-free mode</p>
          </div>
          <ToggleSwitch value={profile.focus_mode_enabled === 'true'} onChange={() => toggle('focus_mode_enabled')} />
        </div>
      </section>

      {/* Stats */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-600/20 flex items-center justify-center">
            <Layers size={20} className="text-green-400" />
          </div>
          <h2 className="font-semibold text-white">Your Stats</h2>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Streak', value: `${profile.streak_days}d`, color: 'text-orange-400' },
            { label: 'Cards Reviewed', value: profile.total_cards_reviewed, color: 'text-indigo-400' },
            { label: 'Pages Read', value: profile.total_pages_read, color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/5 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-3">About Tabor</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Tabor is an active learning platform that bridges passive reading with rigorous knowledge retention.
          Using offline AI, voice interaction, and spaced repetition, it transforms any text into a bidirectional learning experience.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full">MVP v0.1</span>
          <span className="text-xs bg-white/5 text-slate-500 px-2.5 py-1 rounded-full">Offline AI</span>
          <span className="text-xs bg-white/5 text-slate-500 px-2.5 py-1 rounded-full">SM-2 SRS</span>
        </div>
      </section>
    </div>
  );
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-white/10'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
  );
}
