import { fontFamily } from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class', // Enable dark mode
  theme: {
    extend: {
      colors: {
        'base': '#0a0f1f',       // Near-black blue background
        'primary': '#00a8ff',     // Vibrant electric blue for accents
        'secondary': '#61dafb',   // Lighter, ethereal blue
        'text-heading': '#f0f8ff', // Off-white for headings
        'text-body': '#c0c0c0',     // Light grey for body text
      },
      fontFamily: {
        // Add 'Space Grotesk' for headings and 'Inter' for body
        sans: ['Inter', ...fontFamily.sans],
        display: ['Space Grotesk', ...fontFamily.sans],
      },
      // Define a keyframe animation for the subtle background pulse
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
      },
      // Add the animation to the theme
      animation: {
        'pulse-glow': 'pulseGlow 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};