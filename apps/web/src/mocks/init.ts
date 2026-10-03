export async function initMocks(): Promise<void> {
  if (typeof window === 'undefined') return;

  const isMockEnabled = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || process.env.NEXT_PUBLIC_MOCK === '1';
  if (!isMockEnabled) return;

  try {
    const { startBrowserWorker } = await import('./browser');
    await startBrowserWorker();
  } catch (err) {
    console.warn('[MSW] Failed to start Mock Service Worker', err);
  }
}
