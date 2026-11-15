import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Zap } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes: { id: 'light' | 'dark' | 'neon'; label: string; icon: any }[] = [
    { id: 'light', label: 'Light theme', icon: Sun },
    { id: 'dark', label: 'Dark theme', icon: Moon },
    { id: 'neon', label: 'High-contrast neon theme', icon: Zap },
  ];

  return (
    <div className="flex p-1 rounded-xl border border-border-subtle bg-background/60" role="group" aria-label="Theme selector">
      {themes.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id)}
          aria-label={t.label}
          title={t.label}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            theme === t.id ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-foreground'
          }`}
        >
          <t.icon size={15} />
        </button>
      ))}
    </div>
  );
}
