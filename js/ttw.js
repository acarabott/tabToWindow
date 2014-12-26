var defaults = {
	"original": {resize: false, focus: false, width: 0.5, height: 1, left: 0, top: 0, min_top: 0},
	"new": {resize: false, width: 0.5, height: 1, left: 0.5, top: 0, min_top: 0}
};

function get_resize_toggle(key) {
	var resize = localStorage['ttw_' + key + '-resize'];
	// If unset, return default
	if (typeof resize === "undefined") {
		return defaults[key]['resize'];
	} else {
		return resize === "true";
	}
}

function get_focus_original_toggle() {
	var focus = localStorage['ttw_original-focus'];
	// If unset, return default
	if (typeof focus === "undefined") {
		return defaults['original']['focus'];
	} else {
		return focus === "true";
	}
}

function get_size_and_pos(key) {
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
	// Position the original window iff the user specified to
	if (get_resize_toggle('original')) {
		var vals = get_size_and_pos('original');

		// Move original window
		chrome.windows.update(id, {
			width: vals['width'],
			height: vals['height'],
			left: vals['left'],
			top: vals['top']
		});
	}
}

function create_new_window(original_id, callback) {
	// Get active tab
	chrome.tabs.query({
		currentWindow: true,
		active:true
	}, function (tabs) {
		
		var setupWindow = function(windowParams, updateParams) {
			// Move the tab to a new window, focussing the new or old window
			chrome.windows.create(windowParams, function (newWindow) {
				if (typeof updateParams === "undefined") {
					updateParams = {};
				}
				chrome.windows.update(newWindow.id, updateParams, function() {
					if (get_focus_original_toggle()) {
						chrome.windows.update(original_id, updateParams, function() {
							callback();
						});
					} else {
						callback();
					}
				});
			});
		};

		if (get_resize_toggle('new')) {

			var vals = get_size_and_pos('new');
			
			setupWindow({
				tabId: tabs[0].id,
				width: vals['width'],
				height: vals['height'],
				left: vals['left'],
				top: vals['top'],
				incognito: tabs[0].incognito,
			});

		} else {

			chrome.windows.get(original_id, function (originalWindow) {
				setupWindow({
					tabId: tabs[0].id,
					width: originalWindow.width,
					height: originalWindow.height,
					left: originalWindow.left,
					top: originalWindow.top,
					incognito: tabs[0].incognito,
				}, {
					state: originalWindow.state,
				});
			});

		}

	});
}

function move_windows() {
	chrome.windows.getCurrent({}, function (window) {
		create_new_window(window.id, function() {
			position_original(window.id);
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
	});
}

chrome.commands.onCommand.addListener(tab_to_window);