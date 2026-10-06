import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

const STORAGE_KEY = 'theme_mode';

const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeToDOM = (resolved: 'dark' | 'light') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  initTheme: () => {
    if (typeof window === 'undefined') return;

    let initialTheme: ThemeMode = 'dark';
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        initialTheme = stored;
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }

    const systemTheme = getSystemTheme();
    const resolvedTheme = initialTheme === 'system' ? systemTheme : initialTheme;

    applyThemeToDOM(resolvedTheme);
    set({ theme: initialTheme, resolvedTheme });

    // Listen for OS system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const currentTheme = get().theme;
      if (currentTheme === 'system') {
        const newResolved = e.matches ? 'dark' : 'light';
        applyThemeToDOM(newResolved);
        set({ resolvedTheme: newResolved });
      }
    };

    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      mediaQuery.addListener(handleMediaChange);
    }
  },

  setTheme: (newTheme: ThemeMode) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignore localStorage write errors
    }

    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    applyThemeToDOM(resolved);
    set({ theme: newTheme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const currentResolved = get().resolvedTheme;
    const nextTheme: ThemeMode = currentResolved === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
}));
