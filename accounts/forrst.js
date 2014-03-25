var request = require('request'),
	error = require('../lib/error'),
	gadgets = require('../gadgets/gadgets');

exports.name = 'Forrst';

exports.connect = function(req, updatifiedRes, next, callbackUri, callback) {
	request.post({
		uri: 'https://forrst.com/api/v2/users/auth',
		form: {
			email_or_username: req.body.username,
			password: req.body.password
		},
		strictSSL: true
	}, function(err, forrstRes, body) {
		if (forrstRes && (forrstRes.statusCode === 401 || forrstRes.statusCode === 403)) {
			return updatifiedRes.send(403);
		}

		if (error(err, forrstRes, next)) return;

		try {
			var data = JSON.parse(body);
		} catch (err) {
			return error(err, forrstRes, next);
		}

		callback(null, { token: data.resp.token });
	});
};

exports.gadgets = [ gadgets.Forrst ];