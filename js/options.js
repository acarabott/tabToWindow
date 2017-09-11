/*jslint plusplus: true, passfail: true, browser: true, devel: true, indent: 4, maxlen: 80 */
/*global chrome*/
(function () {
	'use strict';

	const winGrid = 20; // px to use for window grid
	const defaults = {
		"original": {
			width:  50,
			height: 100,
			left:   0,
			top:    0,
		},
		"new": {
			width:  50,
			height: 100,
			left:   50,
			top:    0
		}
	};

	const focusOptions = Array.from(document.getElementsByClassName('focus-option'));
	const resizeOriginal = document.getElementById('resize-original');
	const cloneOriginal = document.getElementById('clone-original');
	const clonePositions = Array.from(document.getElementsByName('clone-position'));
	const copyFullscreen = document.getElementById('copy-fullscreen');

	function restore_options() {
		focusOptions.forEach(option => {
			option.checked = option.id.includes(localStorage.ttw_focus);
		});

		resizeOriginal.checked = localStorage.ttw_resize_original === 'true';
		cloneOriginal.checked = localStorage.ttw_clone_original === 'true';

		clonePositions.find(cp => cp.id === localStorage.ttw_clone_position).checked = true;

		copyFullscreen.checked = localStorage.ttw_copy_fullscreen === 'true';

		Object.keys(defaults).forEach(wKey => {
			Object.keys(defaults[wKey]).forEach(pKey => {
				const id = `${wKey}-${pKey}`;
				const localId = `ttw_${id}`;

				document.getElementById(id).value = localStorage.hasOwnProperty(localId)
					? localStorage[localId]
					: defaults[wKey][pKey];
			});
		});
	}

	function get_focus_name() {
		const focused = focusOptions.find(option => option.checked);
		return focused === undefined ? 'original' : focused.id.replace('focus-', '');
	}

	function save(event) {
		localStorage.ttw_focus = get_focus_name();
		localStorage.ttw_resize_original = resizeOriginal.checked;
		localStorage.ttw_clone_original = cloneOriginal.checked;

		// Save to Local Storage

		// dimensions
		Array.from(document.getElementsByClassName('option')).forEach(input => {
			localStorage[`ttw_${input.id}`] = input.valueAsNumber;
		});

		// close position options
		localStorage.ttw_clone_position = clonePositions.find(cp => cp.checked).id;

		// fullscreen status
		localStorage.ttw_copy_fullscreen = copyFullscreen.checked;
	}

	function make_oninput_handler() {
		return function (event) {
			const input = event.target,
				val = Number(input.value),
				max = Number(input.max),
				min = Number(input.min),
				split = input.id.split('-'),
				$win = $('#' + split[0]);

			$win.css(split[1], `${val}%`);
			$win.resize();

			if (input.checkValidity()) {
				save();
			}
		};
	}

	function make_oninvalid_handler() {
		const submit = document.getElementById('sub');

		return function (event) {
			const input = event.target,
				val = Number(input.value),
				max = Number(input.max),
				min = Number(input.min);

			submit.click();
		};
	}

	function update_window_handling (input_id, window_id, enable_if_checked) {
		const $input =  $(input_id);
		const $win =    $(window_id);
		const checked = $input.prop('checked');
		const enable =  enable_if_checked ? checked : !checked;
		const action =  enable ? 'enable' : 'disable';

		$win.draggable(action);
		$win.resizable(action);
	}

	function update_resize_original () {
		update_window_handling('#resize-original', '#original', true);
	}

	function update_clone_original () {
		const input_id = '#clone-original';
		update_window_handling(input_id, '#new', false);


		// toggle clone position controls if cloning enabled/disabled
		const checked = $(input_id).prop('checked');
		$('.clone-position-option').prop('disabled', !checked);

		const $options = $('#clone-position-options');
		if (checked) {
			$options.show();
		} else {
			$options.hide();
		}
	}

	function update_focus() {
		const focus = get_focus_name();
		const $original = $('#original');
		const $new = $('#new');
		const $focused = focus === 'original' ? $original : $new;
		const $unfocused = focus === 'original' ? $new : $original;
		const border_color = $('.inner-window').css('border-color');

		$('.inner-window', $focused).css('opacity', 1.0);
		$('.inner-window', $unfocused).css('opacity', 0.92);
		$('.button', $focused).css('opacity', 1.0);
		$('.button', $unfocused).css('opacity', 0.1);
	}

	function add_input_handlers() {

		$('.option').each(function(i, input) {
			input.oninput = make_oninput_handler();
			input.oninvalid = make_oninvalid_handler();
		});

		[
			[$('#resize-original'), update_resize_original],
			[$('.focus-option'), update_focus],
			[$('#clone-original'), update_clone_original],
		].forEach(function(pair, i) {
		    pair[0].change(pair[1]);
		});
	}

	function resize_screen() {
		const userScreen = document.getElementById('monitor'),
			width = userScreen.clientWidth,
			ratio = screen.height / screen.width,
			height = Math.round(width * ratio / winGrid) * winGrid;

		userScreen.style.height =  height+ "px";
	}

	function open_extensions() {
		chrome.tabs.update({
			url: $(this).attr('href')
		});
	}

	function update_window_size_and_position(win, ui) {
		const $userScreen = $('#screen');
		const $win = $(win);
		const $inner = $('.inner-window', $win);
		const screenWidth = $userScreen.width();
		const screenHeight = $userScreen.height();
		const width = Math.floor(($(win).width() / screenWidth) * 100);
		const height = Math.floor(($(win).height() / screenHeight) * 100);
		const innerHorizWidth = parseInt($inner.css('border-left-width'), 10) +
													parseInt($inner.css('border-right-width'), 10);
		const innerVertWidth = parseInt($inner.css('border-top-width'), 10) +
												 parseInt($inner.css('border-bottom-width'), 10);

		// update inner-window for borders
		$inner.width($win.width() - innerHorizWidth);
		$inner.height($win.height() - innerVertWidth);

		// update form
		$('#' + $win.attr('id') + '-width').val(width);
		$('#' + $win.attr('id') + '-height').val(height);

		if (ui !== undefined) {
			const left = Math.floor((ui.position.left / screenWidth) * 100);
			const top = Math.floor((ui.position.top / screenHeight) * 100);
			$('#' + $win.attr('id') + '-left').val(left);
			$('#' + $win.attr('id') + '-top').val(top);
		}
	}

	function setup_windows() {
		const $windows = $('.window'),
			$userScreen = $('#screen'),
			screenWidth = $userScreen.width(),
			screenHeight = $userScreen.height();

		// Restore positions from options
		$('.window').each(function () {
			const $this = $(this);
			$this.width($('#' + $this.attr('id') + '-width').val() + "%");
			$this.height($('#' + $this.attr('id') + '-height').val() + "%");
			$this.css('left', $('#' + $this.attr('id') + '-left').val() + "%");
			$this.css('top', $('#' + $this.attr('id') + '-top').val() + "%");

			$this.draggable({
				containment: "parent",
				grid: [screenWidth / winGrid, screenHeight / winGrid]
			});

			$this.resizable({
				containment: "parent",
				handles: "all",
				grid: [screenWidth / winGrid, screenHeight / winGrid],
				minWidth: $this.parent().width() * 0.2,
				minHeight: $this.parent().height() * 0.2
			});

			$this.on('resize', function(event, ui) {
				update_window_size_and_position(this, ui);
				save();
			});

			$this.on('drag', function(event, ui) {
				update_window_size_and_position(this, ui);
				save();
			});
		});

		update_resize_original();
		update_clone_original();
		update_focus();
	}

	function display_shortcuts () {
		chrome.commands.getAll(function(cmds) {
			if (cmds.length === 0) {
				return;
			}
			const $shortcuts = $('#shortcuts');
			const $ul = $('#shortcut-list');

			cmds.forEach(function(cmd, i) {
				const $li = $('<li>');
				const desc = cmd.description;
				const $shortcuts = $('<span>');
				$shortcuts.addClass('shortcut');
				$shortcuts.text(cmd.shortcut);
				$li.append(desc);
				$li.append(': ');
				$li.append($shortcuts);
				$ul.append($li);
			});
		});
	}

	jQuery(document).ready(function($) {
		resize_screen();
		restore_options();
		add_input_handlers();
		setup_windows();
		display_shortcuts();

		$('.window').trigger('resize');
		$('#extensions').click(open_extensions);

		[
		'#sub', '.focus-option', '#resize-original', '#clone-original',
		 '#clone-position-same', '#clone-position-horizontal',
		 '#clone-position-vertical', '#copy-fullscreen'
		].forEach(function(item, i) {
		    $(item).click(save);
		});
	});
}());
