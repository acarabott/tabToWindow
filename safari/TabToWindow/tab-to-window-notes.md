# Tab To Window - Safari Port

## Strategy

- Go through existing code and find areas that will be an issue
- Figure out how to structure resources for multiple platforms
- Figure out how to handle browser inconsistencies

## TODO

- Keyboard Shortcuts
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

### Done



## Issues

- missing system.display permission/API
  - Can't get display info
  - Can still get current screen size via regular browser API
  - Could try moving to next monitor by doing x = screen.width + 1

- (Maybe) can't *move* a tab to another window

- using `windows.update` to change position to `top: 0` with `height: screen.availHeight` gest the wrong position as it doesn't take the browser chrome into account
  - `windows.create` seems fine though
  - using a negative vallue for top works, might have issues on (e.g.) Windows Chrome, or Linux
  - this might only be on external monitor? seems fine on mbp only screen
  
