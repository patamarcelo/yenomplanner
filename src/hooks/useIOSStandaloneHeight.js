import { useLayoutEffect } from 'react';

export function getIOSStandaloneHeight(width, height, angle = 0) {
  // Screen dimensions and physical orientation do not shrink with the keyboard.
  if (!(width > 0 && height > 0)) return null;
  return Math.abs(angle) % 180 === 90 ? Math.min(width, height) : Math.max(width, height);
}

export default function useIOSStandaloneHeight() {
  useLayoutEffect(() => {
    const fullScreen = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content === 'black-translucent';
    if (navigator.standalone !== true || !fullScreen) return;
    const root = document.documentElement;
    const update = () => {
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      const height = getIOSStandaloneHeight(screen.width, screen.height, angle);
      if (height !== null) root.style.setProperty('--ios-standalone-height', `${height}px`);
    };
    root.classList.add('ios-home-screen');
    update();
    window.addEventListener('pageshow', update);
    window.addEventListener('orientationchange', update);
    screen.orientation?.addEventListener('change', update);
    return () => {
      window.removeEventListener('pageshow', update);
      window.removeEventListener('orientationchange', update);
      screen.orientation?.removeEventListener('change', update);
      root.classList.remove('ios-home-screen');
      root.style.removeProperty('--ios-standalone-height');
    };
  }, []);
}
