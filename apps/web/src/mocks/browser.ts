export async function startBrowserWorker(): Promise<void> {
  if (typeof window === 'undefined') return;

  const { setupWorker } = await import('msw/browser');
  const { handlers } = await import('./handlers');

  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/mockServiceWorker.js'
    }
  });

  console.log('[MSW] Mock Service Worker started (NEXT_PUBLIC_MOCK=1)');
}
