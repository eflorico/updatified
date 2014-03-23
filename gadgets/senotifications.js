var gunzip = require('zlib').gunzip,
	request = require('request'),
	assembleGadget = require('./factory').assembleGadget,
	error = require('../lib/error');

module.exports = assembleGadget({
	name: 'SeNotifications',
	account: 'StackExchange',
	uri: 'http://stackexchange.com/',
	update: function(app, callback) {
		request({
			url: 'https://api.stackexchange.com/2.1/inbox/unread?filter=total',
			qs: {
				pagesize: 100,
				access_token: this.user.accounts.stackexchange.token,
				key: app.set('stackexchange-key')
			},
			headers: { 'Accept-Encoding': 'gzip' },
			encoding: null,
			strictSSL: true
		}, function(httpErr, res, data) {
			//Cancel if received data are not gzip encoded
			if (res && res.headers && res.headers['content-encoding'] != 'gzip') {
				return error('Unsupported content-encoding', res, callback);
			//Or if there was no response at all
			} else if (!res) {
				return error(httpErr, data, callback);
			}

			//Handle other errors after gunzipping

			gunzip(data, function(gunzipErr, buffer) {
				//Gunzip failed; report HTTP error if any,
				//otherwise, report gunzip error
				if (gunzipErr) {
					return error(httpErr, res, callback) ||
						error(gunzipErr, res, callback);
				}

				res.body = buffer.toString();

				//Gunzip succeeded; check for HTTP error
				if (error(httpErr, res, callback)) return;

				try {
					var doc = JSON.parse(res.body);
					callback(null, { value: doc.total });
				} catch (err) {
					error(err, res, callback);
				}
			});
		});
	},
	intervals: [
		     3 * 60 * 60,        5 * 60, //3h after login, update every 5m
		    24 * 60 * 60,       20 * 60, //1d after login, update every 20m
		7 * 24 * 60 * 60,   2 * 60 * 60 // 1w after login, update every 2h
	]
});