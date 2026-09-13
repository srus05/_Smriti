/**
 * SMRITI SERVICE WORKER REGISTRATION HELPER
 * Registers the root Service Worker (/sw.js) with scope '/' across all Smriti pages
 * (/auth, /senior-space, /caretaker-studio, /).
 */

export async function registerServiceWorker() {
  if (typeof window === 'undefined') return null;

  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Workers are not supported in this browser environment.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[SW] Registered successfully with scope:', registration.scope);

    // If waiting worker exists, tell it to take control
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New offline assets cached and ready.');
          }
        });
      }
    });

    return registration;
  } catch (err) {
    console.error('[SW] Service Worker registration failed:', err);
    return null;
  }
}

// Attach to window
if (typeof window !== 'undefined') {
  window.registerServiceWorker = registerServiceWorker;

  // Automatically trigger registration on page load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerServiceWorker();
  } else {
    window.addEventListener('DOMContentLoaded', () => registerServiceWorker());
  }
}
