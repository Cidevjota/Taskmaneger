// Detects when a new deploy has shipped while this tab was left open, so we
// can force a logout + reload instead of letting a stale bundle keep talking
// to a schema/API it no longer matches (the concern that motivated this: a
// client left open across a deploy silently corrupting saves).
const CURRENT_VERSION = __APP_VERSION__;
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

let checking = false;

async function checkVersion(onNewVersion: () => void) {
  if (checking) return;
  checking = true;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.version && data.version !== CURRENT_VERSION) {
      onNewVersion();
    }
  } catch {
    // Network hiccup or offline — just try again on the next tick.
  } finally {
    checking = false;
  }
}

// Returns a cleanup function. Checks on an interval and whenever the tab
// regains focus/visibility, so a deploy is caught quickly without needing
// the user to do anything.
export function startVersionWatcher(onNewVersion: () => void): () => void {
  // Delayed first check — avoids flagging a false positive if this load
  // happened to race a CDN edge that hadn't finished propagating the deploy.
  const initialTimeout = setTimeout(() => checkVersion(onNewVersion), 30 * 1000);
  const interval = setInterval(() => checkVersion(onNewVersion), CHECK_INTERVAL_MS);
  const onFocus = () => checkVersion(onNewVersion);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') checkVersion(onNewVersion);
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    clearTimeout(initialTimeout);
    clearInterval(interval);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
