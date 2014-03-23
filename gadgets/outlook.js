var async = require('async'),
	Imap = require('imap'),
	xoauth2 = require('xoauth2'),
	assembleGadget = require('./factory').assembleGadget,
	error = require('../lib/error');

module.exports = assembleGadget({
	name: 'Outlook',
	account: 'Live',
	uri: 'https://mail.live.com/mail/',
	update: function(app, callback) {
		var that = this,
			account = this.user.accounts.live,
			tasks = [ ];

		//Request new access token after expiry
		if (account.expires <= new Date) {
			tasks.push(function(callback) {
				var live = require('../accounts/live');

				live.refresh(app, account.refresh_token, function(err, result) {
					if (error(err, callback)) return;

					//Store new token; it will later be saved together with all other user data
					for (var key in result) {
						that.user.accounts.live[key] = result[key];
					}

					account = that.user.accounts.live;

					callback();
				})
			});
		}

		//Generate XOauth 2 token
		tasks.push(function(callback) {
			xoauth2.createXOAuth2Generator({
				user: account.email,
				accessToken: account.token
			}).getToken(callback);
		});

		//Check for new mails via IMAP
		tasks.push(function(xoauthToken, accessToken, callback) {
			//Establish IMAP connection
			var imap = new Imap({
				xoauth2: xoauthToken,
				host: 'imap-mail.outlook.com',
				port: 993,
				tls: true,
				tlsOptions: { rejectUnauthorized: false }
			}).once('ready', function() {
				//Request number of unread emails
				imap.status('INBOX', function(err, mailbox) {
					if (error(err, callback)) return;

					imap.end();

					//Ensure callback cannot be called twice from ready and error events
					if (callback !== null) {
						callback(null, { value: mailbox.messages.unseen });
						callback = null;
					}
				});
			}).once('error', function(err) {
				error(err, function(err) {
					//Ensure callback cannot be called twice from ready and error events
					if (callback !== null) {
						callback(err);
						callback = null;
					}
				});
			});

			imap.connect();
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