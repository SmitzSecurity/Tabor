import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useAppStore } from '../store';

export function Notification() {
  const { notification, setNotification } = useAppStore();

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  if (!notification) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className="flex items-center gap-3 bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-xl shadow-indigo-900/50">
        <CheckCircle size={18} />
        <span className="text-sm font-medium">{notification}</span>
      </div>
    </div>
  );
}
