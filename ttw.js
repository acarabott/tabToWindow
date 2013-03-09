function tab_to_window() {
	// Check there are more than 1 tabs in current window
	chrome.tabs.query({
		currentWindow: true
	}, function (tabs) {
		if (tabs.length > 1) {
			// Get active tab
			chrome.tabs.query({
				currentWindow: true,
				active:true
			}, function(tabs) {
				var width = localStorage['ttw_width'],
					height = localStorage['ttw_height'],
					left = localStorage['ttw_left'],
					top = localStorage['ttw_top'];

				if (typeof width === "undefined") {
					width = 0.5;
				} else {
					width = width / 100;
				}

				if (typeof height === "undefined") {
					height = 0.5;
				} else {
					height = height / 100;
				}

				if (typeof left === "undefined") {
					left = 0.5;
				} else {
					left = left / 100;
				}

				if (typeof top === "undefined") {
					top = 0;
				} else {
					top = top / 100;
				}

				// Move it to a new window
				chrome.windows.create({
					tabId: tabs[0].id,
					width: screen.width * width,
					height: screen.height * height,
					left: screen.width * left,
					top: screen.width * top,
					focused: true
				}, function () {});
			});
		}
	});
}

chrome.commands.onCommand.addListener(tab_to_window);