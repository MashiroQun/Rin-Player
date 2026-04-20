/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // srcフォルダの中だけ探すようにする
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
