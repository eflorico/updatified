var qs = require('querystring'),
	request = require('request'),
	error = require('../lib/error'),
	factory = require('./factory'),
	gadgets = require('../gadgets/gadgets');

var Google = factory.assembleOAuth2({
	name: 'google',
	accessTokenUri: 'https://accounts.google.com/o/oauth2/token',
	accessTokenMethod: 'post',
	responseType: 'json',
	generateAuthUri: function(appId, callbackUri) {
		return 'https://accounts.google.com/o/oauth2/auth?' +
			qs.stringify({
				client_id: appId,
				response_type: 'code',
				scope: [
					'https://www.googleapis.com/auth/calendar.readonly',
					'https://www.googleapis.com/auth/userinfo.email',
					'https://mail.google.com/'
				].join(' '),
				access_type: 'offline',
				redirect_uri: callbackUri //TODO: login_hint
			});
	},
	afterConnect: function(result, callback) {
		//Obtain gmail address
		request({
			uri: 'https://www.googleapis.com/userinfo/email',
			qs: {
				alt: 'json',
				access_token: result.token
			},
			strictSSL: true
		}, function(err, res, body) {
			if (error(err, res, callback)) return;

			try {
				var doc = JSON.parse(body);
				result.email = doc.data.email;
				callback(null, result);
			} catch (err) {
				error(err, res, callback);
			}
		});
	},
	disconnect: function(data, callback) {
		request({
			uri: 'https://accounts.google.com/o/oauth2/revoke',
			qs: {
				token: data.token
			},
			strictSSL: true
		}, function(err, res, body) {
			if (error(err, res, callback)) return;

			callback();
		});
	}
});

Google.name = 'Google';
Google.gadgets = [ gadgets.Gmail, gadgets.Gcal ];

module.exports = Google;