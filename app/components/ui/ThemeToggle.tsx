'use client';

import { useTheme, Theme } from '@/app/contexts/ThemeContext';
import { Button } from './Button/Button';

interface ThemeToggleProps {
  /** Display variant */
  variant?: 'segmented' | 'icon';
  /** Additional CSS classes */
  className?: string;
}

const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    ),
  },
];

export function ThemeToggle({ variant = 'segmented', className = '' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (variant === 'icon') {
    // Single icon button that cycles through modes
    const cycleTheme = () => {
      const currentIndex = themes.findIndex((t) => t.value === theme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex].value);
    };

    const currentTheme = themes.find((t) => t.value === theme) || themes[1];

    return (
      <Button
        onClick={cycleTheme}
        className={`!p-2 !min-w-[44px] !min-h-[44px] !flex !items-center !justify-center !text-foreground ${className}`}
        variant="ghost"
        size="sm"
        aria-label={`Theme: ${currentTheme.label}. Click to change.`}
        title={`Current theme: ${currentTheme.label}`}
      >
        <span>{currentTheme.icon}</span>
      </Button>
    );
  }

  // Segmented control
  return (
    <div
      className={`inline-flex rounded-lg bg-muted p-1 ${className}`}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {themes.map((t) => (
        <Button
          key={t.value}
          onClick={() => setTheme(t.value)}
          variant={theme === t.value ? 'primary' : 'ghost'}
          size="sm"
          className={`!px-3 !py-1.5 !text-sm !flex !items-center !justify-center !gap-1.5 !rounded-md ${
            theme === t.value ? '!shadow-sm' : ''
          }`}
          role="radio"
          aria-checked={theme === t.value}
          aria-label={t.label}
        >
          {t.icon}
          {/*<span className="hidden sm:inline">{t.label}</span>*/}
        </Button>
      ))}
    </div>
  );
}
