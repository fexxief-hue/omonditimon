(() => {
  const button = document.getElementById('pwa-install-button');
  const sheet = document.getElementById('pwa-install-sheet');
  if (!button || !sheet) return;

  const closeButton = sheet.querySelector('[data-pwa-close].pwa-install-close');
  const closeTargets = sheet.querySelectorAll('[data-pwa-close]');
  let deferredInstallPrompt = null;
  let previousFocus = null;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function closeInstallSheet() {
    sheet.hidden = true;
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  function showInstallSheet() {
    previousFocus = document.activeElement;
    sheet.dataset.platform = isIOS ? 'ios' : 'android';
    sheet.hidden = false;
    closeButton.focus();
  }

  function refreshInstallButton() {
    button.hidden = isStandalone() || (!deferredInstallPrompt && !isIOS);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    refreshInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    refreshInstallButton();
  });

  button.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      showInstallSheet();
      return;
    }

    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (choice?.outcome === 'accepted') refreshInstallButton();
  });

  closeTargets.forEach(target => target.addEventListener('click', closeInstallSheet));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !sheet.hidden) closeInstallSheet();
  });

  function updateMobileNavigation() {
    const nav = document.querySelector('.mobile-app-nav');
    document.body.classList.toggle('pwa-public-navigation', Boolean(nav));
  }
  window.addEventListener('hashchange', updateMobileNavigation);
  const appRoot = document.getElementById('app');
  if (appRoot) new MutationObserver(updateMobileNavigation).observe(appRoot, { childList: true, subtree: true });
  updateMobileNavigation();
  refreshInstallButton();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(error => {
      console.warn('Los Blancos FC app shell could not be registered.', error);
    });
  }
})();
