function get_size_and_pos(key) {
	// TODO If we convert these -> percentages -> pixel values, why do these
	// start so low?
	var defaults = {
		'original': {width: 0.5, height: 1, left: 0, top: 0, min_top: 0},
		'new': {width: 0.5, height: 1, left: 0.5, top: 0, min_top: 0}
	};

	var properties = {
		width : localStorage['ttw_' + key + '-width'],
		height : localStorage['ttw_' + key + '-height'],
		left : localStorage['ttw_' + key + '-left'],
		top : localStorage['ttw_' + key + '-top'],
		min_top : localStorage.ttw_min_top
	};

	for (var pKey in properties) {
		if (typeof properties[pKey] === 'undefined') {
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

	// Account for possible OS menus
	properties[top] += properties.min_top;

	return properties;
}

function position_original(id) {
	var vals = get_size_and_pos('original');

	// Move original window
	chrome.windows.update(id, {
		width: vals.width,
		height: vals.height,
		left: vals.left,
		top: vals.top
	});
}

function get_clone_vals(orig) {
	var pos = localStorage.ttw_clone_position;
	var vals = {};

	if (pos === 'clone-position-same') {
		vals.width = orig.width;
		vals.height = orig.height;
		vals.left = orig.left;
		vals.top = orig.top;

	} else if (pos === 'clone-position-horizontal') {
		// Position windows left and right of each other
		vals.height = orig.height;
		vals.top = orig.top;

		// Find which side has more space
		var orig_right = orig.left + orig.width;
		var right_space = screen.width - orig_right;

		console.log(orig_right, right_space);
		if (orig.left < right_space) {
			// position new window on right of original window
			vals.width = Math.min(orig.width, right_space);
			vals.left = right;
		} else {
			// position new window on left of original window
			var width = Math.min(orig.width, orig.left);
			vals.width = width;
			vals.left = orig.left - width;
		}
		console.log(vals.width, vals.left);

	} else if (pos === 'clone-position-vertical') {
		// Position windows above and below of each other
		vals.left = orig.left;
		vals.width = orig.width;

		var orig_bot = orig.top + orig.height;
		var bottom_space = screen.height - orig_bot;

		if (orig.top < bottom_space) {
			// position new window below original window
			vals.height = Math.min(orig.height, bottom_space);
			vals.top = orig_bot;
		} else {
			// position new window above original window
			var height = Math.min(orig.height, orig.top);
			vals.height = height;
			vals.top = orig.top - height;
		}
	}

	return vals;
}

// The tab needs a home!
function create_new_window(window_type, original_window) {
	// Get active tab
	chrome.tabs.query({
		currentWindow: true,
		active: true
	}, function (tabs) {
		var tab, vals;

		tab = tabs[0];

		// If we are cloning the origin window, use the origin window values
		if (localStorage.ttw_clone_original === 'true') {
			vals = get_clone_vals(original_window);
		} else {
			vals = get_size_and_pos('new');
		}

		// Move the tab to a new window
		chrome.windows.create({
			tabId: 		tab.id,
			width: 		vals.width,
			height: 	vals.height,
			left: 		vals.left,
			top: 		vals.top,
			type: 		window_type,
			focused: 	localStorage.ttw_focus_new === 'true',
			incognito: 	tab.incognito
		}, function (window) {
			// save parent id in case we want to pop_in
			sessionStorage['ttw_pop_origin_' + tab.id] = original_window.id;

			// Focus on original window if designated
			if (localStorage.ttw_focus_new === 'false') {
				chrome.windows.update(original_window.id, {
					focused: true
				});
			}
		});
	});
}

// Take tab out of window
function move_tab_out(window_type) {
	chrome.windows.getCurrent({}, function (window) {
		if (localStorage.ttw_resize_original === 'true') {
			position_original(window.id);
		}
		create_new_window(window_type, window);
	});
}

// Create window to store in
function tab_to_window(window_type) {
	// Check there are more than 1 tabs in current window
	chrome.tabs.query({
		currentWindow: true
	}, function (tabs) {
		// Only 1 tab, do nothing
		if (tabs.length <= 1) {
			return;
		}

		// store the minimum top value: create window at 0 and check screenTop
		if (localStorage.ttw_min_top === undefined) {
			chrome.windows.create({
				top: 	 0,
				focused: false
			}, function(window) {
				localStorage.ttw_min_top = window.screenTop;
				chrome.windows.remove(window.id, function() {
					move_tab_out(window_type);
				});
			});
		} else {
			// TODO Simplify to just use default value
			move_tab_out(window_type);
		}
	});
}

function tab_to_normal_window () {
	tab_to_window('normal');
}

function tab_to_popup_window () {
	tab_to_window('popup');
}

// Return a tab to the window from whence it came
function window_to_tab() {
	chrome.tabs.query({
		currentWindow: true,
		active: 	   true
	}, function(tabs) {
		var tab = tabs[0];

		var origin_key = 'ttw_pop_origin_' + tab.id;
		// Check if original window exists
		if (!sessionStorage.hasOwnProperty(origin_key)) {
			return;
		}

		var origin_window_id = parseInt(sessionStorage[origin_key]);

		// check original window still exists
		chrome.windows.get(origin_window_id, {}, function(originWindow) {
			if (chrome.runtime.lastError) {
				return;
			}

			// move the current tab
			chrome.tabs.move(tab.id, {
				windowId: origin_window_id,
				index:    -1
			}, function() {
				sessionStorage.removeItem(origin_key);
				chrome.tabs.update(tab.id, {
					active: true
				});
			});
		});
	});
}

// Listen for hotkey command
chrome.commands.onCommand.addListener(function(command) {
	var lookup = {
		'tab-to-window-normal': tab_to_normal_window,
		'tab-to-window-popup':  tab_to_popup_window,
		'window-to-tab': 		window_to_tab
	};

	if (lookup.hasOwnProperty(command)) {
		lookup[command]();
	}
});
