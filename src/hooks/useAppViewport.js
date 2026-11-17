import { useLayoutEffect } from 'react';

export function getAppViewport(viewport, innerHeight, activeElement, unobscuredHeight = innerHeight) {
  // Pinch zoom must not resize the application or be mistaken for a keyboard.
  const followsViewport = viewport && Math.abs(viewport.scale - 1) < 0.01;
  const editing = activeElement?.matches?.('input, textarea, [contenteditable="true"]');
  const keyboardOpen = Boolean(editing && followsViewport && unobscuredHeight - viewport.height > 120);
  // Leave browser chrome resizing to CSS. Only the keyboard needs a pixel override.
  return {
    height: keyboardOpen ? viewport.height : null,
    top: keyboardOpen ? viewport.offsetTop : 0,
    keyboardOpen,
  };
}

export default function useAppViewport(enabled) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let unobscuredHeight = viewport?.height || window.innerHeight;
    let viewportWidth = window.innerWidth;
    const update = () => {
      if (!document.activeElement?.matches?.('input, textarea, [contenteditable="true"]')) {
        unobscuredHeight = viewport?.height || window.innerHeight;
      }
      if (viewportWidth !== window.innerWidth) {
        viewportWidth = window.innerWidth;
        unobscuredHeight = window.innerHeight;
      }
      const { height, top, keyboardOpen } = getAppViewport(
        viewport, window.innerHeight, document.activeElement, unobscuredHeight,
      );
      if (height === null) root.style.removeProperty('--app-viewport-height');
      else root.style.setProperty('--app-viewport-height', `${height}px`);
      root.style.setProperty('--app-viewport-top', `${top}px`);
      root.style.setProperty('--app-safe-bottom', keyboardOpen ? '0px' : 'env(safe-area-inset-bottom, 0px)');
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', schedule);
    window.addEventListener('pageshow', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      ['--app-viewport-height', '--app-viewport-top', '--app-safe-bottom'].forEach((key) => root.style.removeProperty(key));
    };
  }, [enabled]);
}
