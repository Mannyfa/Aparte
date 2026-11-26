import React, { useEffect, useState } from 'react';
import { Share, PlusSquare, X, Download } from 'lucide-react';

const DISMISS_KEY = 'apartey:install-dismissed';

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

const isStandalone = () =>
  window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

// iPhone / iPad Safari (iPadOS reports itself as a Mac with touch). In-app browsers (Instagram,
// WhatsApp…) can't add to the home screen, so they're skipped.
const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|WhatsApp|Line\//.test(ua);
  return ios && safari;
};

/**
 * "Add Apartey to your home screen" card.
 * - iPhone/iPad Safari: explains Share → Add to Home Screen (Safari has no install API).
 * - Chrome/Edge/Android: uses the browser's install prompt.
 * Shown once a few seconds after the first visit; dismissing hides it for good on that device.
 */
export default function InstallPrompt() {
  const [mode, setMode] = useState(null); // 'ios' | 'native' | null
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    if (isStandalone() || read(DISMISS_KEY)) return undefined;

    const onBeforeInstall = (e) => {
      e.preventDefault(); // keep the event so our own button can trigger it
      setDeferred(e);
      setMode('native');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const timer = isIosSafari() ? setTimeout(() => setMode('ios'), 6000) : null;
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => { write(DISMISS_KEY, '1'); setMode(null); };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    dismiss();
  };

  if (!mode) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] px-3 pb-safe animate-fade-up sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:px-0" role="dialog" aria-label="Install Apartey">
      <div className="mb-3 flex gap-3 rounded-2xl border border-line bg-paper p-4 shadow-lift sm:mb-0">
        <img src="/icons/apple-touch-icon.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Add Apartey to your home screen</p>
          {mode === 'ios' ? (
            <p className="mt-1 text-muted">
              Tap <Share size={14} className="inline -mt-0.5" aria-label="Share" /> <span className="text-ink">Share</span>, then{' '}
              <PlusSquare size={14} className="inline -mt-0.5" aria-hidden="true" /> <span className="text-ink">Add to Home Screen</span>.
            </p>
          ) : (
            <>
              <p className="mt-1 text-muted">Open it like an app, full screen, in one tap.</p>
              <button onClick={install} className="btn-ink btn-sm mt-3"><Download size={14} /> Install</button>
            </>
          )}
        </div>
        <button onClick={dismiss} className="btn-ghost btn-sm -mr-2 -mt-1 h-8 self-start" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
