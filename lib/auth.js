var url = require('url'),
	error = require('./error');

exports.middleware = function(loginRequired, redirect) {
	return function(req, res, next) {
		//Prepare redirect URL to carry destination for redirect after login
		if (loginRequired) {
			//Parse auth redirect URL and requested URL
			redirect = url.parse(redirect, true);
			var requestedURL = url.parse(req.url, true);

			//Pass on email parameter to login page
			if (requestedURL.query.email) {
				redirect.query.email = requestedURL.query.email;
			}

			//Discard all other parameters
			requestedURL.search = '';
			requestedURL.query = { };

			//Remember requested URL without leading slash for redirect after login
			redirect.query.dst = url.format(requestedURL).substr(1);

			redirect = url.format(redirect);
		}

		//If session exists
		if (req.session.user) {
			//Attempt to retrieve user
			req.db.collection('users').findById(req.session.user, function(err, user) {
				if (error(err, req.session, next)) return;

				//If user is found, store in request
				if (user) {
					req.user = user;
				//Otherwise, delete useless session
				} else {
					req.session.destroy();
				}

				//If user is logged in
				if (user && loginRequired) {
					const year = 365 * 24 * 60 * 60 * 1000;

					//Set knownUser cookie to recognise user after logout
					res.set('set-cookie', 'knownUser=' + user.identities.basic.email +
						'; Expires=' + new Date(+new Date + year).toUTCString());

					//Update activity timestamp in database
					req.db.collection('users').updateById(user._id, {
						$set: { lastActivity: new Date }
					}, function(err) {
						error(err, user, next);
					});
				}

				//If user is logged in or out as desired, proceed
				if (loginRequired === Boolean(user)) {
					next();
				//Otherwise, redirect
				} else {
					res.redirect(redirect);
				}
			});
		//If session does not exist
		} else {
			//If user is supposed to be logged out, proceed
			if (!loginRequired) {
				next();
			//If user is supposed to be logged in, redirect
			} else {
				res.redirect(redirect);
			}
		}
	};
};

exports.login = function(user, redirect, req, res) {
	req.session.user = user._id;
	res.redirect(redirect);
};

exports.hash = function(app, password) {
	return require('crypto')
		.createHash('sha256')
		.update(password + app.set('salt'))
		.digest('hex');
};