/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          light: '#dcf8c6',
          dark: '#075e54',
          green: '#25d366',
          teal: '#128c7e',
          bg: '#ece5dd',
        },
      },
    },
  },
  plugins: [],
};
