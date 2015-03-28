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
		min_top : localStorage.ttw_min_top
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

function get_origin_id(id) {
	return 'ttw_pop_origin_' + id;
}

function create_new_window(window_type, original_id) {
	// Get active tab
	chrome.tabs.query({
		currentWindow: true,
		active: true
	}, function (tabs) {
		var tab, vals;

		tab = tabs[0];
		vals = get_size_and_pos('new');

		// Move it to a new window
		chrome.windows.create({
			tabId: 		tab.id,
			width: 		vals.width,
			height: 	vals.height,
			left: 		vals.left,
			top: 		vals.top,
			type: 		window_type,
			focused: 	localStorage.ttw_focus_new === "true",
			incognito: 	tabs[0].incognito
		}, function (window) {
			// save parent id in case we want to pop_in
			sessionStorage[get_origin_id(tab.id)] = original_id;
		});
	});
}

function move_tab_out(window_type) {
	chrome.windows.getCurrent({}, function (window) {
		if (localStorage.ttw_resize_original === 'true') {
			position_original(window.id);
		}
		create_new_window(window_type, window.id);
	});
}

function tab_to_window(window_type) {
	// Check there are more than 1 tabs in current window
	chrome.tabs.query({
		currentWindow: true
	}, function (tabs) {
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

function window_to_tab() {
	chrome.tabs.query({
		currentWindow: true,
		active: 	   true
	}, function(tabs) {
		var tab = tabs[0];

		var popped_key = get_origin_id(tab.id);
		if (!sessionStorage.hasOwnProperty(popped_key)) {
			return;
		}

		var origin_window_id = parseInt(sessionStorage[popped_key]);

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
				sessionStorage.removeItem(popped_key);
			});
		});
	});
}

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