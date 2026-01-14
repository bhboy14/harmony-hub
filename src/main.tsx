import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[SW] Service Worker registered:', registration.scope);

      // Request notification permission for prayer time alerts
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Handle background sync
      if ('sync' in registration) {
        // Sync prayer times when coming back online
        window.addEventListener('online', () => {
          (registration as any).sync.register('sync-prayer-times');
        });
      }

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_PRAYER_TIMES') {
          // Trigger prayer times refresh
          window.dispatchEvent(new CustomEvent('sync-prayer-times'));
        }
      });
    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
