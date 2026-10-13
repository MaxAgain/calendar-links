import { InlineScript } from './inline-script';

// Applies the stored theme to <html> before the first paint, so there is no flash of the wrong theme.
// Keep the storage key in sync with theme-provider.tsx.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("sk-theme")||"system",d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches),e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";e.lang="en"}catch(_){}})()`;

export function ThemeScript() {
  return <InlineScript html={THEME_SCRIPT} />;
}
