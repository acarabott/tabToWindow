# TODO

## Manifest v3

- Update API calls: https://developer.chrome.com/docs/extensions/develop/migrate/api-calls
  - Replace functions that expect a Manifest V2 background context
  - Replace unsupported APIs
- Replace blocking web request listeners: https://developer.chrome.com/docs/extensions/develop/migrate/blocking-web-requests
- Improve extension security: https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- Publish your extension: https://developer.chrome.com/docs/extensions/develop/migrate/publish-mv3

## Cleanup

- Layout on options screen, now narrow extra colon
- options-page.ts filter for each
- consolidate getHighlightedTabs and unhilightTabs? check if windowIds always match

## Testing

- test all methods
  - actionsTabs.ts
  - actionsURLS.ts

### Done

- Update the manifest: https://developer.chrome.com/docs/extensions/develop/migrate/manifest
- Migrate to a service worker: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers
