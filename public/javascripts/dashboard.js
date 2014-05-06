var updatified = {
	isFocused: false,
	showingSetup: false,
	popupsEnabled: function() {
		//Determines whether HTML5 webkit notifications are available and have been permitted by the user
		return window.webkitNotifications && window.webkitNotifications.checkPermission() === 0;
	},
	suggestEnablingPopups: function() {
		//If webkit notifications are supported and the user has not yet declined this prompt
		if (window.webkitNotifications &&
				window.webkitNotifications.checkPermission() === 1 &&
				document.cookie.indexOf('notifications=false;') === -1) {
			//Show prompt for notifications
			$('#notification').show();

			$('#enable-notifications').click(function() {
				window.webkitNotifications.requestPermission();
				$('#notification').hide();
				return false;
			});

			$('#dismiss-notifications').click(function() {
				var oneYearAhead = new Date(+new Date + 1000 * 60 * 60 * 24 * 365);
				document.cookie = 'notifications=false; expires=' + oneYearAhead.toGMTString() + '; path=/dashboard';

				$('#notification').hide();

				return false;
			});
		}
	},
	popupsOnScreen: [],
	update: function(repeat) {
		var self = this;

		//Wait 10 seconds
		setTimeout(function() {
			$.ajax({
				type: 'get',
				url: '',
				cache: false,
				dataType: 'json',
				success: function(newData) {
					//Show notifications
					self.showPopups(newData);

					for (var gadget in newData) {
						if (!newData.hasOwnProperty(gadget)) continue;

						//Update gadget
						if (newData[gadget] !== null) {
							self.gadgets[gadget].textNode.nodeValue = newData[gadget];
						} else {
							self.gadgets[gadget].textNode.nodeValue = ':-(';
						}

						self.gadgets[gadget].element.toggleClass('error', newData[gadget] === null);
					}
				},
				complete: function() {
					//Schedule next update after 10 more seconds
					if (repeat) self.update.call(self, true);
				}
			});
		}, 10000);
	},
	showPopups: function(newData) {
		//Check for notifications if Updatified is opened in background
		if (this.isFocused) return;

		var showAsterisk = false;

		//Gadgets that trigger popups and associated message
		var popupTriggers = {
			gmail: 'unread email',
			fbnotifications: 'Facebook notification',
			forrst: 'Forrst notification',
			senotifications: 'StackExchange notification',
			github: 'GitHub notification'
		};

		for (var gadget in newData) {
			//Skip gadget if it doesn't trigger popups
			if (!popupTriggers[gadget]) continue;

			//Detrmine number of new objects
			var delta = newData[gadget] - parseInt(this.gadgets[gadget].textNode.nodeValue);

			//Show popup and asterisk
			if (delta > 0) {
				var message = delta + ' new ' + popupTriggers[gadget] + (delta > 1 ? 's' : '');
				this.showPopup(gadget, message);
			}

			//Show asterisk for any unseen change
			if (newData[gadget] - this.gadgets[gadget].seenValue > 0)
				showAsterisk = true;
			//Update seen value if number has decreased
			else
				this.gadgets[gadget].seenValue = newData[gadget];
		}

		//Update title
		if (showAsterisk) document.title = 'Updatified *';
		else document.title = 'Updatified';
	},
	showPopup: function(gadget, message) {
		var self = this;

		//Show asterisk in title bar

		//Show desktop notification if possible
		if (this.popupsEnabled()) {
			var popup = window.webkitNotifications.createNotification('images/' + gadget + '.png', message, '');
			this.popupsOnScreen.push(popup);
			popup.show();

			//Auto-hide popup after 5s
			setTimeout(function() {
				popup.cancel();
				self.popupsOnScreen.splice(self.popupsOnScreen.indexOf(popup), 1);
			}, 5000);
		}
	},
	initSetup: function() {
		var self = this;

		function hideSetupForm(forms) {
			forms.animate({
				opacity: 0,
				top: '-10px'
			}, 100, function() {
				$(this).hide();
			});
		}

		function showSetupForm(forms) {
			forms.show().css({
				opacity: 0,
				top: '-10px'
			}).animate({
				opacity: 1,
				top: '0px'
			}, 100); //Show this setup

			$(forms).find('input[type=text]:eq(0)').focus();
		}

		$('.gadget a').click(function() {
			var gadget = $(this).closest('.gadget');

			if (!self.showingSetup && !gadget.is('.error')) {
				return true;
			}

			var state;

			if (gadget.is('.error')) {
				state = 'error';
			} else if (gadget.is('.connected')) {
				state = 'connected';
			} else {
				state = 'disconnected';
			}

			//Find setup forms for this gadget in its current state
			var	setup = $(this).siblings('.setup.' + state);

			//Use center gadget (Greader) for all Google services
			if (setup.length == 0) setup = $('#gmail').find('.setup.' + state);

			if (setup.is(':hidden')) {
				//Hide all other setups
				hideSetupForm($('.setup:visible').not(setup));

				//Show this setup
				showSetupForm(setup);
			}
			else
				//Hide this setup
				hideSetupForm(setup);

			return false;
		});

		//Show loading indicator on all forms
		$('#gadgets form').submit(function(e) {
			//Indicate loading
			var submitBtn = $(this).find('input[type=submit]');
			submitBtn.data('original-label', submitBtn.val());
			submitBtn.attr('disabled', true).val('Loading...');
		});

		//Ajaxify all setup forms
		$('#gadgets form:not(.external)').submit(function(e) {
			//Collect form data
			var form = $(this), data = { };

			$.each(form.serializeArray(), function(i, pair) {
				data[pair.name] = pair.value;
			});

			//Indicate loading
			$(this).find('input').attr('disabled', true);

			$.ajax({
				type: 'post',
				url: form.attr('action'),
				data: data,
				success: function(response) {
					//Find corresponding setup container
					var setup = (form.is('.setup') ? form : form.closest('.setup'));

					//Hide setup and clear form
					setup.animate({
						opacity: 0,
						top: '-10px'
					}, 100, function() {
						$(this).hide();
					});

					//Find affected gadgets
					var gadgets = form.closest('.gadget');

					//All Google gadgets if central Greader form is shown
					if (gadgets.attr('id') === 'gmail') gadgets = $('#gmail, #gcal');

					//Change gadget state and data
					if (data._method === 'put' || data._method === 'patch') {
						gadgets.removeClass('disconnected error').addClass('connected').css('opacity', 1);

						for (var gadget in response) {
							var link = $('#' + gadget + ' a');
							link.contents()[0].nodeValue = response[gadget].text;
							link.attr('href', response[gadget].uri);
						}
					}
					else if (data._method === "delete") {
						var link = gadgets.find('a');

						link.attr('href', '').contents().each(function() {
							if (this.nodeType == 3) this.nodeValue = '0';
						});

						gadgets.removeClass('connected').addClass('disconnected').show();
					}
				},
				error: function(xhr) {
					if (xhr.status === 403) {
						alert('We could not log you in with this email address and password. Are you sure your password is correct?');
					} else if (/\/yweather$/.test(form.attr('action')) && xhr.status === 404) {
						alert('We could not find any weather data for this place. Maybe you can try entering a larger nearby city?');
					} else {
						alert('Sorry, that didn\'t work. :( Try again, and, if it\'s still not working, let us know at hello@updatified.com!');
					}
				},
				complete: function() {
					//Restore form to normal state
					form.find('input').attr('disabled', false);

					var submitBtn = form.find('input[type=submit]');
					submitBtn.val(submitBtn.data('original-label'));
				}
			});

			e.preventDefault();
		});
	},
	toggleSetup: function(showSetup) {
		//Prevent double initializition
		if (showSetup == this.showingSetup) return;

		//Enable setup
		if (showSetup) {
			//Enable gadget click handlers
			this.showingSetup = true;

			$('#instructions').show();

			//Show disconnected services
			$('.gadget.disconnected').show();
			$('#gadgets').attr('class', 'items-' + $('.gadget').length);

			$('#settings').text('I\'m done adding gadgets');
		}
		//Disable setup
		else {
			//Disable gadget click handlers
			this.showingSetup = false;

			$('#instructions').hide();

			//Hide disconnected services
			$('.gadget.disconnected').hide();
			$('#gadgets').attr('class', 'items-' + $('.gadget.connected').length);

			//Hide all setup forms
			$('.setup').hide();

			$('#settings').text('gadgets');
		}

		return false;
	},
	init: function() {
		var self = this;

		//Determine functionality supported by browser and necessary prefix
		this.browser = { };

		if (typeof document.hidden !== "undefined") {
			this.browser.hidden = "hidden";
			this.browser.visibilityChange = "visibilitychange";
		}
		else if (typeof document.mozHidden !== "undefined") {
			this.browser.hidden = "mozHidden";
			this.browser.visibilityChange = "mozvisibilitychange";
		}
		else if (typeof document.msHidden !== "undefined") {
			this.browser.hidden = "msHidden";
			this.browser.visibilityChange = "msvisibilitychange";
		}
		else if (typeof document.webkitHidden !== "undefined") {
			this.browser.hidden = "webkitHidden";
			this.browser.visibilityChange = "webkitvisibilitychange";
		}

		//Update every 10s via AJAX
		this.update(true);

		//Keep track of window focus
		function onFocus() {
			//Save state
			self.isFocused = true;

			//Remove asterisk
			document.title = 'Updatified';

			//Hide popups
			for (var i = 0; i < self.popupsOnScreen.length; i++)
				self.popupsOnScreen[i].cancel();

			self.popupsOnScreen = [];
		}

		function onBlur() {
			//Save state
			self.isFocused = false;

			//Mark all changes as seen
			for (var gadget in self.gadgets)
				self.gadgets[gadget].seenValue = parseInt(self.gadgets[gadget].textNode.nodeValue);
		}

		//Use HTML5 page visibility API when possible
		if (this.browser.visibilityChange)
			$(document).bind(this.browser.visibilityChange, function() {
				if (!document[self.browser.hidden]) onFocus();
				else onBlur();
			});
		//Fallback to traditional events
		else
			$(window).bind('focus mousemove', onFocus).blur(onBlur);

		//Show prompt to enable webkit notifications if available
		this.suggestEnablingPopups();

		//Build list of gadgets
		this.gadgets = { };

		$('.gadget').each(function() {
			var textNode = $(this).find('div a').contents()[0];

			self.gadgets[this.id] = {
				element: $(this),
				textNode: textNode,
				seenValue: parseInt(textNode.nodeValue)
			};
		});

		//Setup
		self.initSetup();

		$('#settings').click(function(e) {
			if (self.showingSetup)
				if (window.history) window.history.pushState(false, 'Updatified', 'http://updatified.com/dashboard');
				else document.location = '#';
			else
				if (window.history) window.history.pushState(true, 'Updatified - Settings', 'http://updatified.com/settings');
				else document.location = '#settings';

			self.toggleSetup(!self.showingSetup);

			return e.preventDefault();
		});

		$(window).on('popstate', function() {
			self.toggleSetup(window.history.state === true);
		});

		//Show setup according to URI / if no gadgets are set up
		if (document.location.hash == '#settings' || document.location.pathname == '/settings' || $('.gadget.connected').length === 0) {
			if (window.history) window.history.replaceState(true, 'Updatified - Settings', 'http://updatified.com/settings');
			this.toggleSetup(true);
		}
	}
};

updatified.init();
