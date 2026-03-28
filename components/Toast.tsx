'use client';

import { useCallback, useState } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let _addToast: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function toast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  _addToast?.({ message, type });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500);
  }, []);

  _addToast = add;

  const icons: Record<string, string> = { success: '✓', error: '✕', info: 'ℹ' };
  const colors: Record<string, string> = { success: 'var(--green)', error: 'var(--red)', info: 'var(--blue)' };

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{ color: colors[t.type], fontWeight: 700, fontSize: '1rem' }}>{icons[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
