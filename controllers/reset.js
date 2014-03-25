var uuid = require('node-uuid'),
	auth = require('../lib/auth'),
	error = require('../lib/error');

exports.registerController = function(app) {
	//Require user to be logged out
	app.all(/\/reset($|\/)/, auth.middleware(false, '/dashboard'));

	/*
		Step #1: Request the passwort to be reset
	*/

	//Handle password reset request
	app.post('/reset', function(req, res, next) {
		//Basic validation
		if (!req.body.email || req.body.email.indexOf('@') === -1) {
			res.locals.error = 'email';
			return next();
		}

		//Attempt to find user
		req.db.collection('users').findOne({
			'identities.basic.email': req.body.email.toLowerCase()
		}, function(err, user) {
			if (error(err, next)) return;

			//Abort if user doesn't exist or already has requested a recovery code
			if (!user) {
				res.locals.error = 'notSignedUp';
			} else if (user.recoverycodeexpiry > new Date) {
				res.locals.error = 'alreadyRequested';
			}

			if (res.locals.error) return next();

			//Generate recovery code
			var recoveryCode = uuid.v4();

			//Store recovery code and expiry time (now + 15 min)
			req.db.collection('users').updateById(user._id, { $set: {
				recoverycode: recoveryCode,
				recoverycodeexpiry: new Date(+new Date + 1000 * 60 * 15)
			} }, function(err, users) {
				if (error(err, next)) return;

				//Send email
				app.render('emails/password-recovery', {
					link: app.set('uri') + 'reset/' + recoveryCode
				}, function(err, text) {
					if (error(err, next)) return;

					app.mail({
						to: user.identities.basic.email,
						subject: 'Updatified Password Recovery',
						text: text
					}, function(err) {
						if (error(err, next)) return;

						next();
					});
				});
			});
		});
	});

	//Show password reset request form
	app.all('/reset', function(req, res, next) {
		//If form has not yet been submitted or errors have occcured
		if (req.method === 'GET' || res.locals.error) {
			//Show form to request password reset
			res.render('request-reset', {
				stylesheet: 'index',
				email: req.body.email || req.cookies.knownUser || ''
			});
		//If reset request has been successfully submitted
		} else {
			//Show confirmation page
			res.render('reset-requested', { stylesheet: 'index' });
		}
	});

	/*
		Step #2: Set a new password
	*/

	//Find user
	app.all('/reset/:code', function(req, res, next) {
		//Find user by recovery code
		req.db.collection('users').findOne({
			recoverycode: req.params.code,
			recoverycodeexpiry: { $gte: new Date }
		}, function(err, user) {
			if (error(err, next)) return;

			//Abort if user was not found or recovery code has expired
			if (!user) return res.redirect('/reset');

			req.user = user;
			next();
		});
	});

	//Handle password reset
	app.post('/reset/:code', function(req, res, next) {
		//Validation
		if (req.body.password.trim() === '') {
			res.locals.error = 'password';
		} else if (req.body.password !== req.body.passwordRepetition) {
			res.locals.error = 'passwordRepetition';
		}

		if (res.locals.error) return next();

		//Remove recovery code and reset password
		req.db.collection('users').updateById(req.user._id, {
			$unset: {
				recoverycode: 1,
				recoverycodeexpiry: 1
			},
			$set: {
				'identities.basic.password': auth.hash(req.app, req.body.password)
			}
		}, function(err) {
			if (error(err, next)) return;

			//Log in
			auth.login(req.user, '/dashboard', req, res);
		});
	});

	//Show password reset form
	app.all('/reset/:code', function(req, res, next) {
		//Since the user is redirected after a successful password reset,
		//this point is only reached by GET requests or when the reset failed
		res.render('reset-password', {
			stylesheet: 'index'
		});
	});
};