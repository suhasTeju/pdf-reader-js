/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  prefix: 'pdf-',
  theme: {
    extend: {
      colors: {
        'pdf-primary': 'var(--pdf-primary, #3b82f6)',
        'pdf-bg': 'var(--pdf-bg, #ffffff)',
        'pdf-text': 'var(--pdf-text, #1f2937)',
        'pdf-border': 'var(--pdf-border, #e5e7eb)',
        'pdf-highlight': 'var(--pdf-highlight, #fef08a)',
      },
    },
  },
  plugins: [],
};
