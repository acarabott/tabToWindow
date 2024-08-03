# TODO

## Manifest v3

- Migrate to a service worker: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers

  - Because they can't access the DOM or the window interface, you'll need to move such calls to a different API or into an offscreen document.
  - Event listeners should not be registered in response to returned promises or inside event callbacks.
  - Since they're not backward compatible with XMLHttpRequest() you'll need to replace calls to this interface with calls to fetch().
  - Since they terminate when not in use, you'll need to persist application states rather than rely on global variables. Terminating service workers can also end timers before they have completed. You'll need to replace them with alarms.

- Update API calls: https://developer.chrome.com/docs/extensions/develop/migrate/api-calls
- Replace blocking web request listeners: https://developer.chrome.com/docs/extensions/develop/migrate/blocking-web-requests
- Improve extension security: https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- Publish your extension: https://developer.chrome.com/docs/extensions/develop/migrate/publish-mv3

### Done

- Update the manifest: https://developer.chrome.com/docs/extensions/develop/migrate/manifest
