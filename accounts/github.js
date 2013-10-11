var qs = require('querystring'),
	factory = require('./factory'),
	gadgets = require('../gadgets/gadgets');

var GitHub = factory.assembleOAuth2({
	name: 'github',
	accessTokenUri: 'https://github.com/login/oauth/access_token',
	accessTokenMethod: 'post',
	responseType: 'querystring',
	generateAuthUri: function(appId, callbackUri) {
		return 'https://github.com/login/oauth/authorize?' +
			qs.stringify({
				client_id: appId,
				scope: 'notifications',
				redirect_uri: callbackUri
			});
	}
});

GitHub.name = 'GitHub';
GitHub.gadgets = [ gadgets.GitHub ];

module.exports = GitHub;