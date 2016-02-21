/*jslint plusplus: true, passfail: true, browser: true, devel: true, indent: 4, maxlen: 80 */
/*global chrome*/
(function () {
	'use strict';

	var winGrid = 20; // px to use for window grid
	var defaults = {
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

	var focusInput = document.getElementById('focus-new');
	var resizeOriginal = document.getElementById('resize-original');
	var cloneOriginal = document.getElementById('clone-original');
	var clonePositions = document.getElementsByName('clone-position');

	function restore_options() {
		var wKey, pKey, id, input, value;

		focusInput.checked = localStorage.ttw_focus_new === 'true';
		resizeOriginal.checked = localStorage.ttw_resize_original === 'true';
		cloneOriginal.checked = localStorage.ttw_clone_original === 'true';

		for (var i = 0; i < clonePositions.length; i++) {
			if (localStorage.ttw_clone_position === clonePositions[i].id) {
				clonePositions[i].checked = true;
			}
		}

		for (wKey in defaults) {
			if (defaults.hasOwnProperty(wKey)) {
				for (pKey in defaults[wKey]) {
					if (defaults[wKey].hasOwnProperty(pKey)) {
						id = wKey + "-" + pKey;
						input = document.getElementById(id);
						value = localStorage['ttw_' + id];

						if (value === undefined) {
							value = defaults[wKey][pKey];
						}

						input.value = value;
					}
				}
			}
		}
	}

	function save(event) {
		var inputs = document.getElementsByClassName('option'),
			submit = document.getElementById('sub'),
			valid = true,
			i;

		localStorage.ttw_focus_new = focusInput.checked;
		localStorage.ttw_resize_original = resizeOriginal.checked;
		localStorage.ttw_clone_original = cloneOriginal.checked;

		// Save to Local Storage
		for (i = 0; i < inputs.length; i++) {
			if (inputs[i].checkValidity()) {
				localStorage['ttw_' + inputs[i].id] = inputs[i].valueAsNumber;
			}
		}

		for (i = 0; i < clonePositions.length; i++) {
			if (clonePositions[i].checked) {
				localStorage.ttw_clone_position = clonePositions[i].id;
			}
		}
	}

	function make_oninput_handler() {
		return function (event) {
			var input = event.target,
				val = Number(input.value),
				max = Number(input.max),
				min = Number(input.min),
				split = input.id.split('-'),
				$win = $('#' + split[0]);

			$win.css(split[1], val + '%');
			$win.resize();

			if (input.checkValidity()) {
				save();
			}
		};
	}

	function make_oninvalid_handler() {
		var submit = document.getElementById('sub');

		return function (event) {
			var input = event.target,
				val = Number(input.value),
				max = Number(input.max),
				min = Number(input.min);

			submit.click();
		};
	}

	function update_window_handling (input_id, window_id, enable_if_checked) {
		var $input =  $(input_id);
		var $win =    $(window_id);
		var $hidden = $('.hidden-info', $win);
		var checked = $input.prop('checked');
		var enable =  enable_if_checked ? checked : !checked;
		var action =  enable ? 'enable' : 'disable';
		var opacity = enable ? 1.0 : 0.5;

		$win.draggable(action);
		$win.resizable(action);
		$win.css('opacity', opacity);

		if (enable) {
			$hidden.hide();
		} else {
			$hidden.show();
		}
	}

	function update_resize_original () {
		update_window_handling('#resize-original', '#original', true);
	}

	function update_clone_original () {
		update_window_handling('#clone-original', '#new', false);
	}

	function add_input_handlers() {
		$('.option').each(function(i, input) {
			input.oninput = make_oninput_handler();
			input.oninvalid = make_oninvalid_handler();
		});

		[
			[$('#resize-original'), update_resize_original],
			[$('#clone-original'), update_clone_original],
		].forEach(function(pair, i) {
		    pair[0].change(pair[1]);
		});
	}

	function resize_screen() {
		var userScreen = document.getElementById('monitor'),
			width = userScreen.clientWidth,
			ratio = screen.height / screen.width,
			height = Math.round(width * ratio / winGrid) * winGrid;

		userScreen.style.height =  height+ "px";
	}

	function open_extensions() {
		chrome.tabs.update({
			url: 'chrome://extensions/configureCommands'
		});
	}

	function update_window_size_and_position(win, ui) {
		var $userScreen, $win, $inner, screenWidth, screenHeight, width, height,
			left, top, innerHorizWidth, innerVertWidth;

		$userScreen = $('#screen');
		$win = $(win);
		$inner = $('.inner-window', $win);
		screenWidth = $userScreen.width();
		screenHeight = $userScreen.height();
		width = Math.floor(($(win).width() / screenWidth) * 100);
		height = Math.floor(($(win).height() / screenHeight) * 100);
		innerHorizWidth = parseInt($inner.css('border-left-width'), 10) +
			parseInt($inner.css('border-right-width'), 10);
		innerVertWidth = parseInt($inner.css('border-top-width'), 10) +
			parseInt($inner.css('border-bottom-width'), 10);

		// update inner-window for borders
		$inner.width($win.width() - innerHorizWidth);
		$inner.height($win.height() - innerVertWidth);

		// update form
		$('#' + $win.attr('id') + '-width').val(width);
		$('#' + $win.attr('id') + '-height').val(height);

		if (typeof ui !== 'undefined') {
			left = Math.floor((ui.position.left / screenWidth) * 100);
			top = Math.floor((ui.position.top / screenHeight) * 100);
			$('#' + $win.attr('id') + '-left').val(left);
			$('#' + $win.attr('id') + '-top').val(top);
		}
	}

	function setup_windows() {
		var $windows = $('.window'),
			$userScreen = $('#screen'),
			screenWidth = $userScreen.width(),
			screenHeight = $userScreen.height();

		// Restore positions from options
		$('.window').each(function () {
			var $this = $(this);
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
	}

	function display_shortcuts () {
		chrome.commands.getAll(function(cmds) {
			if (cmds.length === 0) {
				return;
			}
			var $shortcuts = $('#shortcuts');
			var $ul = $('#shortcut-list');

			cmds.forEach(function(cmd, i) {
				var $li = $('<li>');
				var desc = cmd.description;
				var $shortcuts = $('<span>');
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
		'#sub', '#focus-new', '#resize-original', '#clone-original',
		 '#clone-position-same', '#clone-position-horizontal',
		 '#clone-position-vertical'
		].forEach(function(item, i) {
		    $(item).click(save);
		});
	});
}());
