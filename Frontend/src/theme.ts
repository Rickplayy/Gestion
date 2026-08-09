import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';

// Paleta oscura + acento verde, migrada 1:1 de las variables --bg/--card-bg/
// --accent/etc. que usaba App.css en la versión React. `primary` es la escala
// completa (50-950) que PrimeVue usa para botones/enlaces/focus; `surface`
// remapea los grises base para que las tarjetas y fondos coincidan.
export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#e9ebec',
          100: '#c8cbcd',
          200: '#9aa1a6',
          300: '#6c7378',
          400: '#454b4e',
          500: '#2a2d30',
          600: '#212426',
          700: '#1a1c1f',
          800: '#16181a',
          900: '#111213',
          950: '#0a0b0c',
        },
      },
    },
  },
});

export const themeOptions = {
  preset: AppPreset,
  options: {
    darkModeSelector: '.p-dark',
    cssLayer: false,
  },
};
