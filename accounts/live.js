var qs = require('querystring'),
	request = require('request'),
	factory = require('./factory'),
	error = require('../lib/error'),
	gadgets = require('../gadgets/gadgets');

var Live = factory.assembleOAuth2({
	name: 'live',
	accessTokenUri: 'https://login.live.com/oauth20_token.srf',
	accessTokenMethod: 'post',
	responseType: 'json',
	generateAuthUri: function(appId, callbackUri) {
		return 'https://login.live.com/oauth20_authorize.srf?' +
			qs.stringify({
				client_id: appId,
				response_type: 'code',
				scope: [
					'wl.emails',
					'wl.imap',
					'wl.offline_access'
				].join(' '),
				redirect_uri: callbackUri //TODO: login_hint
			});
	},
	afterConnect: function(result, all_data, callback) {
		//Obtain email address
		request({
			uri: 'https://apis.live.net/v5.0/me',
			qs: {
				access_token: result.token
			},
			strictSSL: true
		}, function(err, res, body) {
			if (error(err, res, callback)) return;

			try {
				var doc = JSON.parse(body);
				result.email = doc.emails.account;

				if (!result.email) {
					throw new Error("No account email address found");
				}

				callback(null, result);
			} catch (err) {
				error(err, res, callback);
			}
		});
	},

});

Live.name = 'Live';
Live.gadgets = [ gadgets.Outlook ];

module.exports = Live;