var _ = require('underscore'),
	auth = require('../lib/auth'),
	error = require('../lib/error'),
	geoIo = require('../lib/geoio'), 
	Yweather = require('../gadgets/yweather');

//Handles a signup request after all data have been validated
function handleSignup(req, res, next) {
	var ipAddress = req.headers['x-forwarded-for'] || req.ip;

	//Locate user for weather
	geoIo.locateIp(req.app, ipAddress, function(err, location) {
		//Jump to account creation when IP could not be located
		if (err) return createUser(req, res, next, null, 'c');

		//Build location string for Yahoo API
		var locationName = _.values(_.pick(location || [ ], 
			[ 'area', 'province', 'country' ])).join(', ');

		//Retrieve woeid for Yahoo weather
		Yweather.getWoeid(req.app, locationName, function(err, place) {
			var tempUnit = 'c';
			
			if (place) {
				location.woeid = place.woeid;

				//Set temperature unit to fahrenheit for US users
				tempUnit = (location.countrycode == 'US' ? 'f' : 'c');
			//Discard location entirely when no woeid could be found
			} else {
				location = null;
			}
	
			createUser(req, res, next, location, tempUnit);
		});
	});
}

//Creates a user account as specified in the request and logs the user in
function createUser(req, res, next, location, tempUnit) {
	user = {
		identities: { basic: { 
			email: req.body.email.toLowerCase(), 
			password: auth.hash(req.app, req.body.password) 
		} },
		accounts: { },
		location: location,
		tempUnit: tempUnit,
		gadgets: { }
	};

	//If user has been successfully located
	if (location && location.woeid) {
		//Add weather gadget and run initial update
		(new Yweather(user)).update(req.app, function(err) {
			saveUser(user);
		});
	} else {
		saveUser(user);
	}

	//Store user in database
	function saveUser(user) {
		req.db.collection('users').insert(user, function(err, newUsers) {
			if (error(err, next)) return;

			//Log in new user
			auth.login(newUsers[0], '/dashboard#settings', req, res);
		});
	}
}

exports.registerController = function(app) {
	//Require user to be logged out
	app.all(/^\/(login|signup)?$/, auth.middleware(false, '/dashboard'));

	//Handle login and signup forms
	app.post(/^\/(login|signup)?$/, function(req, res, next) {
		//The presence of the password repetition is used to determine
		//whether the user is signing up or logging in 
		//such that users can log in via the sign up form
		//when leaving the password repetition blank

		//Determine intended action (login or signup)
		var isSignup = Boolean(req.body.passwordRepetition);
		
		//Basic validation
		if (req.body.email.indexOf('@') === -1) {
			res.locals.error = 'email';
		} else if (req.body.password.trim() === '') {
			res.locals.error = 'password';
		} else if (isSignup && req.body.password !== req.body.passwordRepetition) {
			res.locals.error = 'passwordRepetition';
		} else if (isSignup && !req.body.love) {
			res.locals.error = 'noLove';
		}

		//Display error message and abort if validation has failed
		if (res.locals.error) return next();
		
		//Attempt to find user in order to log in or to avoid duplicates
		req.db.collection('users').findOne({ 
			'identities.basic.email': req.body.email.toLowerCase()
		}, function(err, user) {
			if (error(err, next)) return;
			
			//When logging in
			if (!isSignup) {
				//User found, log him in
				if (user && user.identities.basic.password === 
						auth.hash(req.app, req.body.password)) {
					auth.login(user, '/dashboard', req, res);
				//User not found
				} else {
					//If this request originated from the login form
					if (req.path === '/login') {
						//Indicate wrong credentials
						res.locals.error = 'invalidCredentials';
					//If this request originated from the signup form
					} else {
						//Indicate a password mismatch
						res.locals.error = 'passwordRepetition';
					}
								
					next();
				}
			//When signing up
			} else if (isSignup) {
				//User found
				if (user) {
					//Indicate duplicate email
					res.locals.error = 'alreadySignedUp';
					next();
				//User not found, sign him up
				} else {
					handleSignup(req, res, next);
				}
			}
		});
	});
	
	//Show login and signup forms
	app.all(/^\/(login|signup)?$/, function(req, res) {
		//If signup form was explicitly requested
		if (req.path === '/signup') {
			//Discard remembered email address and redirect to signup form
			res.setHeader('set-cookie', 'knownUser=; Expires=' +
				new Date(+new Date - 24 * 60 * 60 * 1000).toUTCString());
			return res.redirect('/');
		}
		
		//If form was already submitted
		if (req.method === 'POST') {
			//Show submitted form with error messages
			if (req.body.login) {
				res.locals.form = 'login';
			} else if (req.body.signup) {
				res.locals.form = 'signup';
			}
		//If login form was requested or user has been remembered
		} else if (req.path === '/login' || req.cookies.knownUser) {
			res.locals.form = 'login';
		} else {
			res.locals.form = 'signup';
		}

		res.render(res.locals.form, { 
			stylesheet: 'index', 
			email: req.body.email || req.cookies.knownUser || '',
			love: req.method === 'POST' ? req.body.love : true
		});
	});
}; 