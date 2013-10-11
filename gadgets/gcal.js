var async = require('async'),
	request = require('request'),
	assembleGadget = require('./factory').assembleGadget,
	error = require('../lib/error');
	
module.exports = assembleGadget({
	name: 'Gcal',
	account: 'Google',
	uri: 'https://www.google.com/calendar/',
	update: function(app, callback) {
		var account = this.user.accounts.google,
			that = this;

		var tasks = [ ];

		//Request new access token after expiry
		if (account.expires <= new Date) {
			tasks.push(function(callback) {
				var google = require('../accounts/google');
				app.log('Refreshing token of ' + that.user.identities.basic.email);
				google.refresh(app, account.refresh_token, function(err, result) {
					if (error(err, callback)) return;

					//Store new token; it will later be saved together with all other user data
					for (var key in result) {
						that.user.accounts.google[key] = result[key];
					}

					account = that.user.accounts.google;
					
					callback();
				})
			});
		}

		//Update calendar list every 24h
		if (!this.data.calendars || 
			+new Date - this.data.lastCalendarUpdate >= 24 * 60 * 60 * 1000)
		{
			tasks.push(updateCalendars);
		}

		//Check each calendar for events
		tasks.push(checkForEvents);

		async.waterfall(tasks, callback);

		function updateCalendars(callback) {
			request({
				url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
				qs: { 
					minAccessRole: 'reader',
					access_token: account.token
				},
				strictSSL: true
			}, function(err, res, body) {
				if (error(err, res, callback)) return;

				try {
					//Parse calendar list
					var doc = JSON.parse(body);
					that.data.calendars = [ ];

					for (var i = 0; i < doc.items.length; i++) {
						that.data.calendars.push(doc.items[i].id);
					}

					that.data.lastCalendarUpdate = new Date;

					callback();			
				} catch (err) {
					error(err, res, callback);
				}
			});
		}

		function isToday(dateString) {
			//Extract timezone from ISO 8601 date string
			var timezone = /(([+-])(\d\d):(\d\d)|Z)$/.exec(dateString),
				offset = 0;

			//If not UTC, compute offset in minutes
			if (timezone[0] !== 'Z') {
				offset = parseInt(timezone[3]) * 60 + parseInt(timezone[4]);

				if (timezone[2] === '-') {
					offset = -offset;
				}
			}

			//Add local timezone offset
			offset += new Date().getTimezoneOffset();

			var serverNow = new Date;

			//Determine local time
			localNow = new Date(+serverNow + offset * 60 * 1000);

			//Determine local day start in server time
			var localDayStart = new Date(+serverNow - 
				localNow.getHours() * 60 * 60 * 1000 -
				localNow.getMinutes() * 60 * 1000 -
				localNow.getSeconds() * 1000 -
				localNow.getMilliseconds());
			
			//Determine local day end in server time
			var localDayEnd = new Date(+localDayStart + 24 * 60 * 60 * 1000);
			
			//Parse local date (and thereby convert to server time)
			var localDate = new Date(dateString);

			//Check if given date is local today
			return localDate >= localDayStart &&
				localDate <= localDayEnd;
		}

		function checkForEvents(callback) {
			//We do not know the calendar's timezone, so we initially
			//look for all events in UTC-12 to UTC+14.
			//toISOString() returns the date in UTC, so we don't have to 
			//worry about the server timezone.
			var start = new Date;
			start.setHours(0);
			start.setMinutes(0);
			start = new Date(+start - 14 * 60 * 60 * 1000);

			var end = new Date(+start + 50 * 60 * 60 * 1000);

			//Request events from every calendar
			async.map(that.data.calendars, function(calendarId, callback) {
				request({
					url: 'https://www.googleapis.com/calendar/v3/calendars/' + 
						calendarId + '/events',
					qs: { 
						timeMin: start.toISOString(),
						timeMax: end.toISOString(),
						access_token: account.token
					},
					strictSSL: true
				}, function(err, res, body) {
					if (error(err, res, callback)) return;
					
					try {
						//Parse response
						var doc = JSON.parse(body),
							events = 0;

						//Count today's events
						for (var i = 0; i < doc.items.length; i++) {
							//Events spanning multiple days only have
							//start.date and end.date set
							if (doc.items[i].start.dateTime &&
								doc.items[i].start.dateTime &&
								(isToday(doc.items[i].start.dateTime) ||
								isToday(doc.items[i].end.dateTime)))
							{
								events++;
							}
						}

						callback(null, events);
					} catch (err) {
						error(err, res, callback, true);
					}
				});
			}, function(err, results) {
				if (error(err, callback)) return;

				//Sum up today's events from all calendars
				var totalEvents = 0;

				for (var i = 0; i < results.length; i++) {
					totalEvents += results[i];
				}

				callback(null, { value: totalEvents });
			});
		}
	},
	checkAvailability: function(app, callback) {
		var token = this.user.accounts.google.token;

		request({
			url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
			qs: { 
				minAccessRole: 'reader',
				access_token: token
			},
			strictSSL: true
		}, function(err, res, body) {
			if (err) return callback(false);

			if (res.statusCode !== 200) {
				return callback(false);
			}

			try {
				//Parse calendar list
				var doc = JSON.parse(body);
				callback(doc.items.length > 0);
			} catch (err) {
				callback(false);
			}
		});
	},
	intervals: [
		          5 * 60,            30, //5m after login, update every 30s 
		     3 * 60 * 60,       10 * 60, //3h after login, update every 10m
		    24 * 60 * 60,       30 * 60, //1d after login, update every 30m
		7 * 24 * 60 * 60,   5 * 60 * 60 // 1w after login, update every 5h
	]
});