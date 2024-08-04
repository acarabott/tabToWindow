# TODO

## Manifest v3

- Publish your extension: https://developer.chrome.com/docs/extensions/develop/migrate/publish-mv3

## Cleanup

- options-page filter for each
- consolidate getHighlightedTabs and unhighlightTabs? check if windowIds always match

## Features

- add options page link to context menu
- action button menu sets options for clicking the button, and opening options page
- options page reacts to changes in options
- add support link to page menu / options screen
- disable window menu items if only one window exists

## Testing

## Installation

- check whether to show update ✅
- check update is correct page ✅

## Storage

- check creating options from changes properly ✅
- check update working ✅
- update action button working ✅

## Commands

- 01-tab-to-window-normal ✅
- 02-tab-to-window-popup ✅
- 03-tab-to-window-next ✅
- 04-tab-to-window-previous ✅
- 05-tab-to-window-display ✅

## Button

- manually check working ✅
- check works when changing window type ✅

## Context menu

- createMenu ✅
- each tab action is working correctly
  - COMMAND_NORMAL ✅
  - COMMAND_POPUP ✅
  - COMMAND_NEXT ✅
  - COMMAND_PREVIOUS ✅
  - COMMAND_DISPLAY ✅
- each url action is working
  - MENU_LINK_TO_WINDOW_ID ✅
  - MENU_LINK_TO_POPUP_ID ✅
  - MENU_LINK_TO_NEXT_ID ✅
  - MENU_LINK_TO_PREVIOUS_ID ✅
  - MENU_LINK_TO_DISPLAY_ID ✅
- switching type works ✅
- changing focus works ✅

## Bugs

- previous window from a popup window
