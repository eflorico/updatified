var qs = require('querystring'),
	request = require('request'),
	error = require('../lib/error'),
	factory = require('./factory'),
	gadgets = require('../gadgets/gadgets');
	
var StackExchange = factory.assembleOAuth2({
	name: 'stackexchange',
	accessTokenUri: 'https://stackexchange.com/oauth/access_token',
	accessTokenMethod: 'post',
	responseType: 'querystring',
	generateAuthUri: function(appId, callbackUri) {
		return 'https://stackexchange.com/oauth?' +
			qs.stringify({
				client_id: appId,
				scope: 'read_inbox no_expiry',
				redirect_uri: callbackUri
			});
	},
	disconnect: function(data, callback) {
		request({
			uri: 'https://api.stackexchange.com/2.1/apps/' + 
				qs.escape(data.token) + '/de-authenticate',
			encoding: null,
			strictSSL: true
		}, function(err, res, data) {
			if (error(err, res, callback)) return;

			callback();
		});
	}
});

StackExchange.name = 'StackExchange';
StackExchange.gadgets = [ gadgets.SeNotifications ];

module.exports = StackExchange;