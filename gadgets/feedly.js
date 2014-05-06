var async = require('async'),
	request = require('request'),
	assembleGadget = require('./factory').assembleGadget,
	error = require('../lib/error');

module.exports = assembleGadget({
	name: 'Feedly',
	account: 'Feedly',
	uri: 'http://feedly.com/',
	update: function(app, callback) {
		var that = this,
			account = this.user.accounts.feedly,
			tasks = [ ];

		//Request new access token after expiry
		if (account.expires <= new Date) {
			tasks.push(function(callback) {
				var feedly = require('../accounts/feedly');

				feedly.refresh(app, account.refresh_token, function(err, result) {
					if (error(err, callback)) return;

					//Store new token; it will later be saved together with all other user data
					for (var key in result) {
						that.user.accounts.feedly[key] = result[key];
					}

					account = that.user.accounts.feedly;

					callback();
				});
			});
		}

		tasks.push(function(callback) {
			request({
				url: 'https://cloud.feedly.com/v3/markers/counts',
				qs: {
					autorefresh: 'true'
				},
				headers: {
					Authorization: 'OAuth ' + account.token
				},
				strictSSL: true
			}, function(err, res, body) {
				if (error(err, res, callback)) return;

				try {
					var doc = JSON.parse(body);

					for (var i = 0; i < doc.unreadcounts.length; i++) {
						var stream = doc.unreadcounts[i];
						if (/^user\/[\w-]+\/category\/global\.all$/.test(stream.id)) {
							callback(null, { value: stream.count });
							return;
						}
					}

					callback('Feedly: Could not find global.all category');
				} catch (err) {
					error(err, res, callback);
				}
			});
		});

		async.waterfall(tasks, callback);
	},
	intervals: [
		          5 * 60,            20, //5m after login, update every 20s
		     3 * 60 * 60,        5 * 60, //3h after login, update every 5m
		    24 * 60 * 60,       20 * 60, //1d after login, update every 20m
		7 * 24 * 60 * 60,   2 * 60 * 60 // 1w after login, update every 2h
	]
});