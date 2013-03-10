/*jslint plusplus: true, passfail: true, browser: true, devel: true, indent: 4, maxlen: 100 */
/*global chrome*/
(function () {
	'use strict';

	var winGrid = 10; // px to use for window grid

	function restore_options() {
		var inputs = document.getElementsByClassName('option'),
			value,
			def,
			i;

		for (i = 0; i < inputs.length; i++) {
			value = localStorage['ttw_' + inputs[i].id];
			if (inputs[i].id === "top") {
				def = 0;
			} else {
				def = 50;
			}

			if (typeof value === "undefined") {
				inputs[i].value = def;
			} else {
				inputs[i].value = value;
			}
		}
	}

	function save_options(event) {
		var inputs = document.getElementsByClassName('option'),
			submit = document.getElementById('sub'),
			valid = true,
			i;

		// Save to Local Storage
		for (i = 0; i < inputs.length; i++) {
			if (inputs[i].checkValidity()) {
				localStorage['ttw_' + inputs[i].id] = inputs[i].valueAsNumber;
			} else {
				valid = false;
			}
		}

		if (valid) {
			event.preventDefault();
			// Update Status
			submit.value = 'Saved';
			submit.style.opacity = '0.5';
			setTimeout(function () {
				submit.value = 'Save';
				submit.style.opacity = '1';
			}, 1000);
		}
	}

	function make_oninput_handler() {
		return function (event) {
			var input = event.target,
				val = Number(input.value),
				max = Number(input.max),
				min = Number(input.min);

			input.checkValidity();
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

	function add_input_handlers() {
		var inputs = document.getElementsByClassName('option'),
			i;

		for (i = 0; i < inputs.length; i++) {
			inputs[i].oninput = make_oninput_handler();
			inputs[i].oninvalid = make_oninvalid_handler();
		}
	}

	function resize_screen() {
		var userScreen = document.getElementById('monitor'),
			width = userScreen.clientWidth,
			ratio = screen.height / screen.width;

		userScreen.style.height = (Math.round(width * ratio / winGrid) * winGrid) + "px";
	}

	function open_extensions() {
		chrome.tabs.update({
			url: 'chrome://extensions/'
		});
	}

	function update_window_size(win, ui) {
		var $userScreen = $('#screen'),
			$win = $(win),
			$inner = $('.inner-window', $win),
			screenWidth = $userScreen.width(),
			screenHeight = $userScreen.height(),
			width = Math.floor(($(win).width() / screenWidth) * 100),
			height = Math.floor(($(win).height() / screenHeight) * 100),

			innerHorizWidth = parseInt($inner.css('border-left-width'), 10) +
				parseInt($inner.css('border-right-width'), 10),
			innerVertWidth = parseInt($inner.css('border-top-width'), 10) +
				parseInt($inner.css('border-bottom-width'), 10);

		// update inner-window for borders
		$inner.width($win.width() - innerHorizWidth);
		$inner.height($win.height() - innerVertWidth);

		// update form
		$('#' + $win.attr('id') + '-width').val(width);
		$('#' + $win.attr('id') + '-height').val(height);
	}

	function update_window_position(win, ui) {
		var $userScreen = $('#screen'),
			$win = $(win),
			screenWidth = $userScreen.width(),
			screenHeight = $userScreen.height(),
			left = Math.floor((ui.position.left / screenWidth) * 100),
			top = Math.floor((ui.position.top / screenHeight) * 100);

		$('#' + $win.attr('id') + '-left').val(left);
		$('#' + $win.attr('id') + '-top').val(top);
	}

	function setup_windows() {
		var $windows = $('.window'),
			$userScreen = $('#screen'),
			screenWidth = $userScreen.width(),
			screenHeight = $userScreen.height();

		$windows.draggable({
			containment: "parent",
			grid: [screenWidth / winGrid, screenHeight / winGrid]
		});

		$windows.resizable({
			containment: "parent",
			handles: "all",
			grid: [screenWidth / winGrid, screenHeight / winGrid]
		});

		$windows.resize(function(event, ui) {
			update_window_size(this, ui);
		});

		$windows.on('drag', function(event, ui) {
			update_window_position(this, ui);
		});
	}

	jQuery(document).ready(function($) {
		resize_screen();
		restore_options();
		add_input_handlers();
		setup_windows();

		$('.window').trigger('resize');
		$('#extensions').click(open_extensions);
		$('#sub').click(save_options);
	});
}());