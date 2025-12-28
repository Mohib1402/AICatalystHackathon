'use client';

import { useEffect } from 'react';

interface SecurityToastProps {
  type: 'blocked' | 'warning' | 'info';
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export default function SecurityToast({ 
  type, 
  message, 
  onClose, 
  autoClose = true,
  duration = 5000 
}: SecurityToastProps) {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'blocked':
        return {
          bg: 'bg-red-50',
          border: 'border-red-400',
          text: 'text-red-900',
          icon: '🚫',
          title: 'Attack Blocked'
        };
      case 'warning':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-400',
          text: 'text-orange-900',
          icon: '⚠️',
          title: 'Security Warning'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-400',
          text: 'text-blue-900',
          icon: 'ℹ️',
          title: 'Security Info'
        };
    }
  };

  const styles = getStyles();

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
      <div className={`rounded-lg border-2 ${styles.border} ${styles.bg} ${styles.text} shadow-xl max-w-md`}>
        <div className="flex items-start gap-3 p-4">
          <span className="text-2xl">{styles.icon}</span>
          <div className="flex-1">
            <h4 className="font-semibold mb-1">{styles.title}</h4>
            <p className="text-sm">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
