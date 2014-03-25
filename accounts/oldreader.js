var request = require('request'),
	error = require('../lib/error'),
	gadgets = require('../gadgets/gadgets');

exports.name = 'OldReader';

exports.connect = function(req, updatifiedRes, next, callbackUri, callback) {
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
	}, function(err, oldReaderRes, body) {
		if (oldReaderRes && (oldReaderRes.statusCode === 401 || oldReaderRes.statusCode === 403)) {
			return updatifiedRes.send(403);
		}

		if (error(err, oldReaderRes, next)) return;

		try {
			var token = /^Auth=(.*?)$/m.exec(body)[1];
		} catch (err) {
			return error(err, oldReaderRes, next);
		}

		callback(null, { token: token });
	});
};

exports.gadgets = [ gadgets.OldReader ];