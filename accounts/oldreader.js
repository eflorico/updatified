var request = require('request'),
	error = require('../lib/error'),
	gadgets = require('../gadgets/gadgets');

exports.name = 'OldReader';

exports.connect = function(req, res, next, callbackUri, callback) {
	request.post({
		uri: 'https://theoldreader.com/accounts/ClientLogin',
		form: {
			client: 'Updatified',
			accountType: 'HOSTED',
			service: 'reader',
			Email: req.body.username,
			Passwd: req.body.password
		},
		strictSSL: true
	}, function(err, res, body) {
		if (error(err, res, next)) return;
		
		try {
			var token = /^Auth=(.*?)$/m.exec(body)[1];
		} catch (err) {
			return error(err, res, next);
		}
		
		if (!token) {
			return res.send(401);
		}

		callback(null, { token: token });
	});
};

exports.gadgets = [ gadgets.OldReader ];