import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        status: {
          ontime: "#1FAE7A",
          atrisk: "#E8A33D",
          breached: "#E5484D",
          idle: "#6B7280",
          info: "#3E7BFA",
        },
      },
    },
  },
  plugins: [],
};
export default config;
