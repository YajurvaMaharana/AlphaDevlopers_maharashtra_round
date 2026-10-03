'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[SW] ServiceWorker registered successfully:', registration.scope);
          })
          .catch((error) => {
            console.warn('[SW] ServiceWorker registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}
