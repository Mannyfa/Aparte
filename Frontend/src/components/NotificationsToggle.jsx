import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

const urlBase64ToUint8Array = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

/**
 * Bell button that turns web push notifications on/off for this device.
 * iPhone: only works when Apartey is opened from the home screen (iOS 16.4+), so it says so.
 */
export default function NotificationsToggle({ withLabel = false }) {
  const [state, setState] = useState('unknown'); // unknown | on | off | denied | unsupported | needs-install
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (isIos() && !isStandalone()) return 'needs-install';
      if (!supported()) return 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      return sub ? 'on' : 'off';
    };
    check().then((s) => { if (!cancelled) setState(s); }).catch(() => { if (!cancelled) setState('off'); });
    return () => { cancelled = true; };
  }, []);

  const turnOn = async () => {
    const { data } = await api.get('/Push/public-key');
    if (!data.enabled) throw new Error('Notifications aren’t set up on the server yet.');

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) throw new Error('Notifications work on the live site (not in development).');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return; }

    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) });
    await api.post('/Push/subscribe', sub.toJSON());
    setState('on');
    toast.success('Notifications are on for this device.');
  };

  const turnOff = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post('/Push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    setState('off');
    toast.success('Notifications are off for this device.');
  };

  const onClick = async () => {
    if (state === 'needs-install') return toast('On iPhone, add Apartey to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on notifications.', { duration: 7000, icon: '📲' });
    if (state === 'unsupported') return toast('This browser doesn’t support notifications.', { icon: '🔕' });
    if (state === 'denied') return toast('Notifications are blocked for Apartey. Allow them in your browser or phone settings, then try again.', { duration: 6000, icon: '🔕' });
    setBusy(true);
    try {
      if (state === 'on') await turnOff(); else await turnOn();
    } catch (error) {
      toast.error(error?.response ? errorMessage(error, 'Couldn’t change notifications.') : (error?.message || 'Couldn’t change notifications.'));
    } finally {
      setBusy(false);
    }
  };

  const Icon = state === 'on' ? BellRing : state === 'denied' || state === 'unsupported' ? BellOff : Bell;
  const label = state === 'on' ? 'Notifications on' : 'Turn on notifications';

  return (
    <button onClick={onClick} disabled={busy || state === 'unknown'} aria-pressed={state === 'on'} title={label} aria-label={label}
      className={`btn-ghost btn-sm ${state === 'on' ? 'text-ink' : ''}`}>
      <Icon size={15} className={state === 'on' ? 'text-lime-deep' : ''} />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
