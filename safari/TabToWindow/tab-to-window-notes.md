# Tab To Window - Safari Port

## Strategy

- [x] Go through existing code and find areas that will be an issue
- [] Figure out how to structure resources for multiple platforms
  - It may be best to have safari+/firefox be a different extension, and factor out chrome code into a shared library
- [] Figure out how to handle browser inconsistencies
  - https://github.com/Lusito/webextension-polyfill-ts



## TODO

- Options page
  - shared data for options
- Multiple monitors


### checked APIs

- actionsTabs.ts
- actionsURLs.ts
- api.ts
- createMenu.ts
- createNewWindow.ts
- doBackgroundAction.ts
- getCloneBounds.ts
- getNeighbouringWindowId.ts
- getNewWindowBounds.ts
- getSizeAndPos.ts
- getTabsToUnhighlight.ts
- getWindowBounds.ts
- index.ts
- moveTabs.ts
- options-page.ts
- options-storage.ts
- unhighlightTabs.ts
- Keyboard Shortcuts
- changing keyboard shortcuts - use injected script


## Issues

- how to handle things that safari does not support?
  - call anyway
  - detect if safari

- missing system.display permission/API
  - Can't get display info
  - Can still get current screen size via regular browser API
  - Could try moving to next monitor by doing x = screen.width + 1
  - might be able to get this info from native container app

- safari does not support `tabs.move`
  - can do `tabs.duplicate`
  - can do `windows.create` with `tabId` as a param "If included, moves a tab of the specified ID from an existing window into the new window."
    - doesn't solve "move to other window" case



- using `windows.update` to change position to `top: 0` with `height: screen.availHeight` gets the wrong position as it doesn't take the browser chrome into account
  - `windows.create` seems fine though
  - using a negative vallue for top works, might have issues on (e.g.) Windows Chrome, or Linux
  - this might only be on external monitor? seems fine on mbp only screen
  
- safari cannot highlight tabs

- safari does not sync items saved in `storage.sync`
  - safari 15 and 15.1 have a bug where data stored in `sync` is put into `local`, so retrieving data from `sync` failes
    - can do a manual copy of data to sync...

- safari background pages can only import modules with the `.js` extension, e.g.
- keyboard shortcuts are better handled in javascript, as otherwise cannot change them.


```js
import { COMMAND_NORMAL } from "./shared.js"; // good
import { COMMAND_NORMAL } from "./shared";    // bad

```
