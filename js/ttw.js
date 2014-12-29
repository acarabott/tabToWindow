function get_size_and_pos(key) {
	var defaults = {
		"original": {width: 0.5, height: 1, left: 0, top: 0, min_top: 0},
		"new": {width: 0.5, height: 1, left: 0.5, top: 0, min_top: 0}
	};
	var properties = {
		width : localStorage['ttw_' + key + '-width'],
		height : localStorage['ttw_' + key + '-height'],
		left : localStorage['ttw_' + key + '-left'],
		top : localStorage['ttw_' + key + '-top'],
		min_top : localStorage['ttw_min_top']
	};
	var pKey;

	for (pKey in properties) {
		if (properties.hasOwnProperty(pKey)) {
			if (typeof properties[pKey] === "undefined") {
				// Use default
				properties[pKey] = defaults[key][pKey];
			} else {
				// Use options value
				properties[pKey] = parseInt(properties[pKey], 10);

				// Convert to percentages
				// min_top is already a pixel value
				if (pKey !== 'min_top') {
					properties[pKey] *= 0.01;
				}
			}

			// Convert percentages to pixel values
			// min_top will already be a pixel value
			if (pKey !== 'min_top') {
				if (pKey === "width" || pKey === "left") {
					properties[pKey] *= screen.availWidth;
				} else if (pKey === "height" || pKey === "top") {
					properties[pKey] *= screen.availHeight;
				}

				properties[pKey] = Math.round(properties[pKey]);
			}
		}
	}

	// Account for possible OS menus
	properties[top] += properties['min_top'];

	return properties;
}

function position_original(id) {
	var vals = get_size_and_pos('original');

	// Move original window
	chrome.windows.update(id, {
		width: vals['width'],
		height: vals['height'],
		left: vals['left'],
		top: vals['top']
	});
}

function create_new_window(original_id) {
	// Get active tab
	chrome.tabs.query({
		currentWindow: true,
		active:true
	}, function (tabs) {
		var vals = get_size_and_pos('new');

		var wintype = 'normal';
		if (localStorage['ttw_popupTab'] == "true") {
			wintype = 'popup';
		}

		// Move it to a new window
		chrome.windows.create({
			tabId: tabs[0].id,
			width: vals['width'],
			height: vals['height'],
			left: vals['left'],
			top: vals['top'],
			type: wintype,
			incognito: tabs[0].incognito
		}, function (newwin) {
		   if (localStorage['ttw_focusNew'] !== 'true') {
				chrome.windows.update(original_id, {
					focused: true
				});
			}
			// save parent id in case we want to pop_in
			sessionStorage[newwin.id]=original_id;
		});
	});
}

function move_windows() {
	chrome.windows.getCurrent({}, function (window) {
		position_original(window.id);
		create_new_window(window.id);
	});
}

function pop_in(outtab, orig_id) {
	chrome.windows.get(orig_id,{},function(orig_win) {
		if ( typeof orig_win === "undefined" ) {
			// not sure this check is required.
			return;
		}
		// Previous window exists
		// It may be necessary to update current window to "normal" before
		// move will work.
		chrome.tabs.move(outtab.id,{
			windowId: orig_id,
			index: -1
			});
	});
}

function tab_to_window() {
	// Check there are more than 1 tabs in current window
	chrome.tabs.query({
		currentWindow: true
	}, function (tabs) {
		if (tabs.length > 1) {
			if (typeof localStorage['ttw_min_top'] === "undefined") {
				chrome.windows.create({
					top:0,
					focused: false
				}, function(window) {
					localStorage['ttw_min_top'] = window.top;
					chrome.windows.remove(window.id, move_windows);
				});
			} else {
				move_windows();
			}
		}
		else {
			chrome.windows.getCurrent({}, function(curwin) {
				// If windows was previously popped-out, try and put it back.
				var orig_id = sessionStorage[curwin.id];
				if ( typeof orig_id === "undefined" ) {
					return;
				}
				pop_in(tabs[0], +orig_id);
			});
		}
	});
}

chrome.commands.onCommand.addListener(tab_to_window);

// vim: tabstop=3 shiftwidth=3
