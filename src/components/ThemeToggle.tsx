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

  const currentIdx = themes.findIndex((t) => t.id === theme);
  const currentTheme = themes[currentIdx >= 0 ? currentIdx : 0];
  const nextTheme = themes[(currentIdx + 1) % themes.length];
  const CurrentIcon = currentTheme.icon;

  return (
    <>
      {/* Mobile: single compact cycle button to avoid cramping headers on 320px–420px phones */}
      <button
        type="button"
        onClick={() => setTheme(nextTheme.id)}
        aria-label={`Theme: ${currentTheme.label}. Tap to switch to ${nextTheme.label}`}
        title={`Switch to ${nextTheme.label}`}
        className="sm:hidden w-9 h-9 rounded-xl border border-border-subtle bg-background/60 flex items-center justify-center text-secondary hover:text-primary transition-colors shrink-0"
      >
        <CurrentIcon size={16} />
      </button>

      {/* Tablet & Desktop: full segmented selector */}
      <div
        className="hidden sm:flex p-1 rounded-xl border border-border-subtle bg-background/60 shrink-0"
        role="group"
        aria-label="Theme selector"
      >
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
    </>
  );
}
