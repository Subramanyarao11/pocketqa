export const colors = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#252525',
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  secondary: '#00D9FF',
  accent: '#FF6B6B',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  border: '#333333',
  borderLight: '#444444',
} as const;

export type ColorToken = keyof typeof colors;
