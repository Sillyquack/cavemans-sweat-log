import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  let isReloadingForUpdate = false;
  let hasShownUpdatePrompt = false;

  function notifyUpdateAvailable(update) {
    if (hasShownUpdatePrompt) return;
    hasShownUpdatePrompt = true;

    window.dispatchEvent(new CustomEvent('caveman:update-available', {
      detail: { update }
    }));
  }

  async function checkForDeployedAssetUpdate() {
    const response = await fetch(`${import.meta.env.BASE_URL}index.html?update-check=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) return;

    const html = await response.text();
    const deployedAssets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)]
      .map((match) => new URL(match[1], window.location.origin).pathname);
    if (!deployedAssets.length) return;

    const loadedAssets = [
      ...[...document.scripts].map((script) => script.src),
      ...[...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href)
    ].filter(Boolean).map((assetUrl) => new URL(assetUrl).pathname);

    const hasNewAsset = deployedAssets.some((assetPath) => !loadedAssets.includes(assetPath));
    if (hasNewAsset) {
      notifyUpdateAvailable(() => window.location.reload());
    }
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: import.meta.env.BASE_URL
      });

      function showUpdatePrompt() {
        notifyUpdateAvailable(() => {
          const waitingWorker = registration.waiting;
          if (!waitingWorker) {
            window.location.reload();
            return;
          }

          // Activating a new service worker reloads app files only. Browser localStorage data stays untouched.
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        });
      }

      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdatePrompt();
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdatePrompt();
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isReloadingForUpdate) return;
        isReloadingForUpdate = true;
        window.location.reload();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
          checkForDeployedAssetUpdate().catch(() => undefined);
        }
      });

      registration.update();
      checkForDeployedAssetUpdate().catch(() => undefined);
    } catch {
      // The app still works normally if service worker registration is unavailable.
    }
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerAppServiceWorker();
