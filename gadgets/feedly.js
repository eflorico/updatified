var request = require('request'),
	assembleGadget = require('./factory').assembleGadget,
	error = require('../lib/error');

module.exports = assembleGadget({
	name: 'Feedly',
	account: 'Feedly',
	uri: 'http://feedly.com/',
	update: function(app, callback) {
		request({
			url: 'https://sandbox.feedly.com/v3/markers/counts',
			qs: {
				autorefresh: 'true'
			},
			headers: {
				Authorization: 'OAuth ' + this.user.accounts.feedly.token
			},
			strictSSL: true
		}, function(err, res, body) {
			if (error(err, res, callback)) return;

			try {
				var doc = JSON.parse(body);

				for (var i = 0; i < doc.unreadcounts.length; i++) {
					if (/^user\/[\w-]+\/category\/global\.all$/.test(doc.unreadcounts[i].id)) {
						callback(null, { value: doc.unreadcounts[i].count });
						return;
					}
				}

				callback('Feedly: global category not found');
			} catch (err) {
				error(err, res, callback);
			}
		});
	},
	intervals: [
		          5 * 60,            20, //5m after login, update every 20s
		     3 * 60 * 60,        5 * 60, //3h after login, update every 5m
		    24 * 60 * 60,       20 * 60, //1d after login, update every 20m
		7 * 24 * 60 * 60,   2 * 60 * 60 // 1w after login, update every 2h
	]
});