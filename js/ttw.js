function get_size_and_pos(key) {
	const defaults = {
		"original": {width: 0.5, height: 1, left: 0, top: 0, min_top: 0},
		"new": {width: 0.5, height: 1, left: 0.5, top: 0, min_top: 0}
	};

	const properties = {
		width : localStorage[`ttw_${key}-width`],
		height : localStorage[`ttw_${key}-height`],
		left : localStorage[`ttw_${key}-left`],
		top : localStorage[`ttw_${key}-top`],
		min_top : localStorage.ttw_min_top
	};

	Object.keys(properties).forEach(pKey => {
		if (properties[pKey] === undefined) {
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

	});

	// Account for possible OS menus
	properties[top] += properties.min_top;

	return properties;
}

function position_original(id) {
	const vals = get_size_and_pos('original');
	// Move original window
	chrome.windows.update(id, {
		width: vals.width,
		height: vals.height,
		left: vals.left,
		top: vals.top
	});
}

function get_origin_id(id) {
	return `ttw_pop_origin_${id}`;
}

function get_clone_vals(orig) {
	const pos = localStorage.ttw_clone_position;
	const copyFullscreen = localStorage.ttw_copy_fullscreen === 'true';
	const vals = {};

	if (pos === 'clone-position-same') {
		vals.width = orig.width;
		vals.height = orig.height;
		vals.left = orig.left;
		vals.top = orig.top;

	} else if (pos === 'clone-position-horizontal') {
		const right = orig.left + orig.width;
		const hgap = screen.width - right;
		vals.height = orig.height;
		vals.top = orig.top;

		// position on right
		if (orig.left < hgap) {
			vals.width = Math.min(orig.width, hgap);
			vals.left = right;
		} else { // position on left
			const width = Math.min(orig.width, orig.left);
			vals.width = width;
			vals.left = orig.left - width;
		}

	} else if (pos === 'clone-position-vertical') {
		const bottom = orig.top + orig.height;
		const vgap = screen.height - bottom;

		vals.left = orig.left;
		vals.width = orig.width;

		// position below
		if (orig.top < vgap) {
			vals.top = bottom;
			vals.height = Math.min(orig.height, vgap);
		} else { // position above
			const height = Math.min(orig.height, orig.top);
			vals.height = height;
			vals.top = orig.top - height;
		}
	}

	vals.fullscreen = copyFullscreen && orig.state === 'fullscreen';

	return vals;
}

function get_new_vals(orig) {
	const vals = get_size_and_pos('new');
	const copyFullscreen = localStorage.ttw_copy_fullscreen === 'true';

	vals.fullscreen = copyFullscreen && orig.state === 'fullscreen';

	return vals;
}

function create_new_window(window_type, original_window) {
	// Get active tab
	chrome.tabs.query({
		currentWindow: true,
		active: true
	}, tabs => {
		const tab = tabs[0];

		// If we are cloning the origin window, use the origin window values
		const vals = localStorage.ttw_clone_original === 'true'
			? get_clone_vals(original_window)
			: get_new_vals(original_window);

		const createData = {
			tabId: tab.id,
			type: window_type,
			focused: localStorage.ttw_focus === 'new',
			incognito: tab.incognito
		};

		if (vals.fullscreen) {
			createData.state = vals.fullscreen ? 'fullscreen' : 'normal';
		}
		else {
			['width', 'height', 'left', 'top'].forEach(key => createData[key] = vals[key]);
		}

		// Move it to a new window
		chrome.windows.create(createData, window => {
			// save parent id in case we want to pop_in
			sessionStorage[get_origin_id(tab.id)] = original_window.id;

			if (localStorage.ttw_focus === "original") {
				chrome.windows.update(original_window.id, {
					focused: true
				});
			}
		});
	});
}

function move_tab_out(window_type) {
	chrome.windows.getCurrent({},  window => {
		const resizeOriginal = localStorage.ttw_resize_original === 'true';
		const copyFullscreen = localStorage.ttw_copy_fullscreen === 'true';
		const originalIsFullscreen = window.state === 'fullscreen';
		if (resizeOriginal && !(copyFullscreen && originalIsFullscreen)) {
			position_original(window.id);
		}
		create_new_window(window_type, window);
	});
}

function tab_to_window(window_type) {
	// Check there are more than 1 tabs in current window
	chrome.tabs.query({
		currentWindow: true
	}, tabs => {
		if (tabs.length <= 1) {
			return;
		}

		// store the minimum top value: create window at 0 and check screenTop
		if (localStorage.ttw_min_top === undefined) {
			chrome.windows.create({
				top: 	 0,
				focused: false
			}, window => {
				localStorage.ttw_min_top = window.screenTop;
				chrome.windows.remove(window.id, () => move_tab_out(window_type));
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
	}, tabs => {
		const tab = tabs[0];

		const popped_key = get_origin_id(tab.id);
		if (!sessionStorage.hasOwnProperty(popped_key)) { return; }

		const origin_window_id = parseInt(sessionStorage[popped_key]);

		// check original window still exists
		chrome.windows.get(origin_window_id, {}, originWindow => {
			if (chrome.runtime.lastError) { return; }

			// move the current tab
			chrome.tabs.move(tab.id, {
				windowId: origin_window_id,
				index:    -1
			}, () => {
				sessionStorage.removeItem(popped_key);
				chrome.tabs.update(tab.id, {
					active: true
				});
			});
		});
	});
}

chrome.commands.onCommand.addListener(command => {
	const lookup = {
		'tab-to-window-normal': tab_to_normal_window,
		'tab-to-window-popup':  tab_to_popup_window,
		'window-to-tab': 				window_to_tab
	};

	if (lookup.hasOwnProperty(command)) {
		lookup[command]();
	}
});
