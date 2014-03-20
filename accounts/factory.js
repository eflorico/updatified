/*
	OAuth 2 functions as follows:

	 1. The user is redirected to the resource owner (e.g. Facebook).
		This is done in connect().
	 2. The user grants us access, whereupon the resource owner
		redirects the user back to us with a code.
		This request is handled by completeConnection().
	 3. Using the code, we request an access token from the resource owner.
		This, too, is done in completeConnection().
*/

var request = require('request'),
	qs = require('querystring'),
	error = require('../lib/error');

/*
	This function generates the function connect() and completeConnection()
	for an OAuth 2 service using the specified data.

	options: {
		name: lower-case string, name of service (e.g. 'facebook')
		generateAuthUri: function(appId, callbackUri), must return string
		accessTokenUri: URI
		accessTokenMethod: 'get' or 'post'
		responseType: 'json' or 'querystring'
	}

	The keys $name-id and $name-secret must be present in config.js.
*/
exports.assembleOAuth2 = function(options) {
	var account = { };

	account.connect = function(req, res, next, callbackUri) {
		//Redirect user to service
		res.redirect(options.generateAuthUri(
			req.app.set(options.name + '-appid'),
			callbackUri
		));
	};

	//Requests an access token with the given params
	//Can be used for initial access token request and token refresh
	function requestToken(app, params, callback) {
		params.client_id = app.set(options.name + '-appid');
		params.client_secret = app.set(options.name + '-secret');

		var req = {
			url: options.accessTokenUri,
			method: options.accessTokenMethod,
			strictSSL: true
		};

		if (options.accessTokenMethod === 'get') {
			req.qs = params;
		} else {
			req.form = params;
		}

		//Request access token
		request(req, function(err, res, body) {
			if (error(err, res, callback)) return;

			//Parse response
			var data;

			try {
				if (options.responseType === 'querystring') {
					data = qs.parse(body);
				} else if (options.responseType === 'json') {
					data = JSON.parse(body);
				} else {
					throw new Error('Unsupported response type ' + options.responseType);
				}
			} catch (err) {
				return error(err, res, callback);
			}

			//Request another access token when a refresh token has been provided
			//(used by Google)
			if (data.refresh_token && !data.access_token) {
				return requestToken(app, {
					refresh_token: data.refresh_token,
					grant_type: 'refresh_token'
				}, callback);
			}

			if (!data.access_token) {
				return error('No access token received', res, callback);
			}

			//Google uses expires_in instead of expires
			if (data.expires_in) {
				data.expires = data.expires_in;
			}

			if (data.expires) {
				//Convert expires field, specified in seconds, to date
				var expires = new Date;
				expires.setTime(expires.getTime() + parseInt(data.expires) * 1000);
				data.expires = expires;
			}

			var result = {
				token: data.access_token,
				expires: data.expires
			};

			//Store refresh token from this or previous request
			if (data.refresh_token || params.refresh_token) {
				result.refresh_token = data.refresh_token || params.refresh_token;
			}

			callback(null, result, data);
		});
	}

	account.completeConnection = function(req, res, next, callbackUri, callback) {
		if (req.query.error) {
			return error(req.query.error_description || req.query.error, req, callback);
		} else if (!req.query.code) {
			return error('No authorization code retrieved', req, callback);
		}

		requestToken(req.app, {
			code: req.query.code,
			redirect_uri: callbackUri,
			grant_type: 'authorization_code'
		}, function(err, result, all_data) {
			if (error(err, result, callback)) return;

			if (options.afterConnect) {
				options.afterConnect(result, all_data, callback);
			} else {
				callback(null, result);
			}
		});
	};

	//Requests a new access token using a refresh token (used by Google)
	//Not applicable for services that require the user to be directed
	//to them for a token refresh (Facebook)
	account.refresh = function(app, refreshToken, callback) {
		requestToken(app, {
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		}, callback);
	};

	if (options.disconnect) {
		account.disconnect = options.disconnect;
	}

	return account;
};