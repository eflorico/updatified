var qs = require('querystring'),
	request = require('request'),
	error = require('../lib/error'),
	factory = require('./factory'),
	gadgets = require('../gadgets/gadgets');

var Feedly = factory.assembleOAuth2({
	name: 'feedly',
	accessTokenUri: 'https://cloud.feedly.com/v3/auth/token',
	accessTokenMethod: 'post',
	responseType: 'json',
	generateAuthUri: function(appId, callbackUri) {
		return 'https://cloud.feedly.com/v3/auth/auth?' +
			qs.stringify({
				response_type: 'code',
				client_id: appId,
				scope: 'https://cloud.feedly.com/subscriptions',
				redirect_uri: callbackUri
			});
	},
	afterConnect: function(result, all_data, callback) {
		result.user_id = all_data.id;
		callback(null, result);
	},
	disconnect: function(app, data, callback) {
		request({
			method: 'POST',
			uri: 'https://cloud.feedly.com/v3/auth/token',
			qs: {
				refresh_token: data.refresh_token,
				client_id: app.set('feedly-appid'),
				client_secret: app.set('feedly-secret'),
				grant_type: 'revoke_token'
			},
			strictSSL: true
		}, function(err, res, body) {
			if (error(err, res, callback)) return;

			callback();
		});
	}
});

Feedly.name = 'Feedly';
Feedly.gadgets = [ gadgets.Feedly ];

module.exports = Feedly;