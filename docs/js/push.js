import { api } from './api.js';

export const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isInstalled = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (error) {
    console.warn('Service Worker fehlt', error);
  }
}

async function currentSubscription() {
  const worker = await navigator.serviceWorker.getRegistration();
  return worker?.pushManager.getSubscription() ?? null;
}

export async function pushStatus() {
  if (isIOS && !isInstalled) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && await currentSubscription()) return 'on';
  return 'off';
}

function keyBytes(text) {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(vapidKey) {
  const answer = await Notification.requestPermission();
  if (answer !== 'granted') return false;
  const worker = await navigator.serviceWorker.ready;
  const subscription = await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(vapidKey),
  });
  await api('/api/push/subscribe', { subscription: subscription.toJSON() });
  return true;
}

// Der Server kann ein Gerät nach Reset oder neuem Code vergessen haben, darum meldet es sich beim Start wieder an.
export async function syncPush() {
  if (await pushStatus() !== 'on') return;
  const subscription = await currentSubscription();
  await api('/api/push/subscribe', { subscription: subscription.toJSON() });
}

export async function disablePush() {
  if (!supported()) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
}
