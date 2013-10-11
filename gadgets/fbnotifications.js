var request = require('request'),
	assembleGadget = require('./factory').assembleGadget,
	error = require('../lib/error');

module.exports = assembleGadget({
	name: 'FbNotifications',
	account: 'Facebook',
	uri: 'https://facebook.com/',
	update: function(app, callback) {
		request({
			uri: 'https://graph.facebook.com/me/notifications',
			qs: { 
				access_token: this.user.accounts.facebook.token
			},
			strictSSL: true
		}, function(err, res, body) {
			if (error(err, res, callback)) return;

			try {
				var doc = JSON.parse(body);
				callback(null, { value: doc.data.length });
			} catch (err) {
				error(err, res, callback);
			}
		});
	},
	intervals: [
		          5 * 60,            20, //5m after login, update every 20s 
		     3 * 60 * 60,        5 * 60, //3h after login, update every 5m
		    24 * 60 * 60,       20 * 60, //1d after login, update every 20m
		7 * 24 * 60 * 60,   2 * 60 * 60 // 1w after login, update every 2h
	]
});