// KIZAR Stream service worker.
//
// One job: apply an update Chrome has already staged, with nothing for the user
// to click and no browser restart.
//
// This only ever fires for an extension published on the Chrome Web Store,
// because that is the only case where Chrome downloads a new version on its
// own. For an unpacked extension it never fires, and the popup's update row is
// used instead.
//
// The download itself deliberately does NOT live here. It began here because a
// blob URL made in the popup dies with the popup and Chrome cancels the
// transfer, but URL.createObjectURL is not available in a worker at all - so
// this file cannot fetch a build and save it. The popup now downloads a signed
// https link directly, which needs nothing running in the background.

chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;
  chrome.storage.local.set({ kizar_installed_at: Date.now() });
});
