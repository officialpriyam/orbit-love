"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("orbit-theme");
      } catch {}
      const value = saved === "dark" || (saved !== "light" && media.matches);
      document.documentElement.dataset.theme = value ? "dark" : "light";
      setDark(value);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("orbit-theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
      <span className="theme-label">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
