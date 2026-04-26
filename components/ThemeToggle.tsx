"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="btn-icon" aria-label="Toggle theme">
        <div className="w-4 h-4 opacity-0" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      className="btn-icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
