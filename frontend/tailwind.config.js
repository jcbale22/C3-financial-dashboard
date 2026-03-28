export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        skin: {
          bg:       'var(--bg)',
          fg:       'var(--fg)',
          surface:  'var(--surface)',
          surface2: 'var(--surface-2)',
          border:   'var(--border)',
          primary:  'var(--primary)',
          muted:    'var(--ui-muted)',
        },
      },
    },
  },
  plugins: [],
}
