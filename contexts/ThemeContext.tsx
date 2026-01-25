import React, { createContext, useContext, useEffect, useState } from 'react';

// Extend Window interface for AndroidBridge
declare global {
  interface Window {
    AndroidBridge?: {
      getAppTheme?: () => string;
      [key: string]: any;
    };
  }
}

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      root.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }, [theme]);

  // Sync with Android App Theme
  useEffect(() => {
    // Check if running in Android app and bridge exists
    if (window.AndroidBridge?.getAppTheme) {
      try {
        const androidTheme = window.AndroidBridge.getAppTheme(); // "SYSTEM", "LIGHT", "DARK"

        let newTheme: Theme | null = null;
        if (androidTheme === 'LIGHT') newTheme = 'light';
        else if (androidTheme === 'DARK') newTheme = 'dark';
        else if (androidTheme === 'SYSTEM') {
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) newTheme = 'dark';
          else newTheme = 'light';
        }

        if (newTheme && newTheme !== theme) {
          setTheme(newTheme);
        }
      } catch (e) {
        console.error('Failed to sync theme from Android', e);
      }
    }
  }, []); // Run once on mount, or could poll if needed

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
