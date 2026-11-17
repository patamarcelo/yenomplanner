const KEY = 'yenomplanner:viewport-diagnostics';
let report = null;

export function viewportDiagnosticsEnabled() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setViewportDiagnosticsEnabled(enabled) {
  if (enabled) localStorage.setItem(KEY, '1');
  else localStorage.removeItem(KEY);
}

export function getViewportDiagnostics() {
  return JSON.stringify(report || { diagnostic: 'viewport-v1', error: 'Inicie a coleta e recarregue o app.' }, null, 2);
}

export function installViewportDiagnostics() {
  if (!viewportDiagnosticsEnabled()) return () => {};
  const started = performance.now();
  const viewport = window.visualViewport;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  report = {
    diagnostic: 'viewport-v1',
    statusBarStyle: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content ?? null,
    standalone: navigator.standalone === true || matchMedia('(display-mode: standalone)').matches,
    screen: [screen.width, screen.height],
    frames: {},
  };
  const height = (element) => element ? Math.round(element.getBoundingClientRect().height) : null;
  // Allowlist only: no input values, text, URLs, account data or credentials.
  const sample = (event) => {
    const modal = document.querySelector('.MuiDialog-paper');
    const actions = modal?.querySelector('.MuiDialogActions-root');
    const content = document.querySelector('[data-viewport-content]');
    return {
      event,
      ms: Math.round(performance.now() - started),
      innerH: innerHeight,
      visualH: viewport ? Math.round(viewport.height) : null,
      visualTop: viewport ? Math.round(viewport.offsetTop) : null,
      scale: viewport?.scale ?? null,
      scrollY: Math.round(scrollY),
      htmlH: height(document.documentElement),
      docScrollH: document.documentElement.scrollHeight,
      contentH: content?.clientHeight ?? null,
      contentScrollTop: content ? Math.round(content.scrollTop) : null,
      bodyH: height(document.body),
      rootH: height(document.getElementById('root')),
      shellH: height(document.querySelector('[data-viewport-shell]')),
      modalH: height(modal),
      modalTop: modal ? Math.round(modal.getBoundingClientRect().top) : null,
      actionsBottom: actions ? Math.round(actions.getBoundingClientRect().bottom) : null,
      safeBottom: parseFloat(getComputedStyle(probe).paddingBottom),
    };
  };
  report.frames.initial = sample('initial');
  let unobscuredH = viewport?.height || innerHeight;
  let previousModal = Boolean(document.querySelector('.MuiDialog-paper'));
  let keyboardSeen = false;
  let keyboardOpen = false;
  let frame = 0;
  const record = (event) => {
    const current = sample(event);
    const modal = current.modalH !== null;
    const focused = document.activeElement?.matches?.('input, textarea, [contenteditable="true"]');
    const currentH = viewport?.height || innerHeight;
    if (event === 'focusin' && modal && !keyboardOpen) {
      unobscuredH = currentH;
      report.frames.beforeKeyboard = current;
    }
    if (focused && modal && unobscuredH - currentH > 120) {
      keyboardOpen = true;
      keyboardSeen = true;
      report.frames.keyboardOpen = current;
    } else if (keyboardOpen && currentH >= unobscuredH - 80) {
      keyboardOpen = false;
      report.frames.keyboardClosed = current;
    }
    if (modal && !previousModal && !report.frames.modalOpened) report.frames.modalOpened = current;
    if (!modal && previousModal) {
      report.frames[keyboardSeen ? 'modalClosedAfterKeyboard' : 'modalClosedBeforeKeyboard'] = current;
    }
    report.frames.latest = current;
    if (keyboardSeen && !keyboardOpen && modal && currentH >= unobscuredH - 80) {
      report.frames.keyboardClosed = current;
    }
    previousModal = modal;
  };
  const onEvent = (event) => {
    // Record each resize: a keyboard transition can span several frames.
    record(event.type);
  };
  const observer = new MutationObserver(() => {
    const modal = Boolean(document.querySelector('.MuiDialog-paper'));
    if (modal !== previousModal) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => record('modal-change'));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', onEvent);
  window.addEventListener('pageshow', onEvent);
  document.addEventListener('scroll', onEvent, { capture: true, passive: true });
  viewport?.addEventListener('resize', onEvent);
  viewport?.addEventListener('scroll', onEvent);
  document.addEventListener('focusin', onEvent);
  document.addEventListener('focusout', onEvent);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onEvent);
    window.removeEventListener('pageshow', onEvent);
    document.removeEventListener('scroll', onEvent, true);
    viewport?.removeEventListener('resize', onEvent);
    viewport?.removeEventListener('scroll', onEvent);
    document.removeEventListener('focusin', onEvent);
    document.removeEventListener('focusout', onEvent);
    probe.remove();
  };
}
