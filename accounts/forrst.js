var request = require('request'),
	error = require('../lib/error'),
	gadgets = require('../gadgets/gadgets');

exports.name = 'Forrst';

exports.connect = function(req, res, next, callbackUri, callback) {
	request.post({
		uri: 'https://forrst.com/api/v2/users/auth',
		form: {
			email_or_username: req.body.username,
			password: req.body.password
		},
		strictSSL: true
	}, function(err, res, body) {
		if (error(err, res, next)) return;

		try {
			var data = JSON.parse(body);
		} catch (err) {
			return error(err, res, next);
		}

		if (!data.resp || !data.resp.token) {
			return res.send(401);
		}

		callback(null, { token: data.resp.token });
	});
};

exports.gadgets = [ gadgets.Forrst ];