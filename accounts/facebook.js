var qs = require('querystring'),
	factory = require('./factory'),
	gadgets = require('../gadgets/gadgets');

var Facebook = factory.assembleOAuth2({
	name: 'facebook',
	accessTokenUri: 'https://graph.facebook.com/oauth/access_token',
	accessTokenMethod: 'get',
	responseType: 'querystring',
	generateAuthUri: function(appId, callbackUri) {
		return 'https://graph.facebook.com/oauth/authorize?' +
			qs.stringify({
				client_id: appId,
				display: 'page',
				scope: 'manage_notifications',
				redirect_uri: callbackUri
			});
	}
});

Facebook.name = 'Facebook';
Facebook.gadgets = [ gadgets.FbNotifications ];

module.exports = Facebook;