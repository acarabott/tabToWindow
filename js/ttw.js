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

		// Move it to a new window
		chrome.windows.create({
			tabId: tabs[0].id,
			width: vals['width'],
			height: vals['height'],
			left: vals['left'],
			top: vals['top'],
			incognito: tabs[0].incognito
		}, function () {
			//chrome.windows.update(original_id, {
			//	focused: true
			//});
			console.log("orig id: " + original_id);
		});
	});
}

function move_windows() {
	chrome.windows.getCurrent({}, function (window) {
		position_original(window.id);
		create_new_window(window.id);
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

//same as previous function but instead of the current tab, 
function new_tab_to_window() {
	//create a new tab
	chrome.tabs.create({url:"chrome://newtab/"});
	//then call the normal function with this new tab open
	tab_to_window();
}

//sets up the listener for the shortcut key
chrome.commands.onCommand.addListener(function(command_string)
{
	console.log("Command triggered: " + command_string);

	//if the command for the new tab first was called, call that
	if(command_string == "new-tab-first") {
		new_tab_to_window();
	} else { //otherwise call the primary action function
		tab_to_window();
	}
});
