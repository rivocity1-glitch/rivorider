// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState } from 'react';

export const COLORS = {
  emeraldGreen: '#2ECC71',
  limeGreen: '#A8E63A',
  jetBlack: '#0D0D0D',
  white: '#FFFFFF',
  offWhite: '#F9F9F9',
  borderLight: '#EFEFEF',
  textMuted: '#888888',
  danger: '#FF3B30',
  cardBg: '#FFFFFF',
  border: '#EAEAEA',
  darkCard: '#1A1A1A',
  darkBorder: '#2A2A2A',
  darkMuted: '#A0A0A0',
};

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  theme: {
    bg: string;
    cardBg: string;
    text: string;
    textMuted: string;
    border: string;
    headerBg: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const theme = {
    bg: isDarkMode ? COLORS.jetBlack : COLORS.offWhite,
    cardBg: isDarkMode ? COLORS.darkCard : COLORS.white,
    text: isDarkMode ? COLORS.white : COLORS.jetBlack,
    textMuted: isDarkMode ? COLORS.darkMuted : COLORS.textMuted,
    border: isDarkMode ? COLORS.darkBorder : COLORS.borderLight,
    headerBg: isDarkMode ? COLORS.darkCard : COLORS.white,
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};