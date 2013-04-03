function get_size_and_pos(key) {
	var width = parseInt(localStorage['ttw_' + key + '-width'], 10),
		height = parseInt(localStorage['ttw_' + key + '-height'], 10),
		left = parseInt(localStorage['ttw_' + key + '-left'], 10),
		top = parseInt(localStorage['ttw_' + key + '-top'], 10);

	if (typeof width === "undefined") {
		width = 0.5;
	} else {
		width = width / 100;
	}

	if (typeof height === "undefined") {
		height = 1;
	} else {
		height = height / 100;
	}

	if (typeof left === "undefined") {
		if (key === "original") {
			left = 0;
		} else {
			left = 0.5;
		}
	} else {
		left = left / 100;
	}

	if (typeof top === "undefined") {
		top = 0;
	} else {
		top = top / 100;
	}

	return {
		width: screen.width * width,
		height: screen.height * height,
		left: screen.width * left,
		top: screen.height * top
	};
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
			top: vals['top']
		}, function () {
			chrome.windows.update(original_id, {
				focused: true
			});
		});
	});
}


function tab_to_window() {
	// Check there are more than 1 tabs in current window
	chrome.tabs.query({
		currentWindow: true
	}, function (tabs) {
		if (tabs.length > 1) {
			chrome.windows.getCurrent({}, function (window) {
				position_original(window.id);
				create_new_window(window.id);
			});
		}
	});
}

chrome.commands.onCommand.addListener(tab_to_window);