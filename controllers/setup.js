var async = require('async'),
	fs = require('fs'),
	qs = require('querystring'),
	auth = require('../lib/auth'),
	error = require('../lib/error'),
	gadgets = require('../gadgets/gadgets');

exports.registerController = function(app) {
	//Load service
	app.all('/dashboard/:service', auth.middleware(true, '/'), function(req, res, next) {
		if (/^[a-z]+$/.test(req.params.service) &&
			fs.existsSync('accounts/' + req.params.service + '.js'))
		{
			req.service = require('../accounts/' + req.params.service);
		} else if (req.params.service !== 'yweather') {
			return res.send(404);
		}

		next();
	});

	//PUT or PATCH Yweather
	app.all('/dashboard/yweather', auth.middleware(true, '/'), function(req, res, next) {
		if (req.method === 'DELETE') {
			return next();
		} else if (req.method !== 'PUT' && req.method !== 'PATCH') {
			return res.send(405);
		}

		//Attempt to find woeid for specified location
		gadgets.Yweather.getWoeid(app, req.body.location, function(err, place) {
			//Send 404 when place was not found
			if (err) return res.send(404);
			
			req.user.location = { area: place.name, woeid: place.woeid };

			//Set temperature unit to Fahrenheit for places in the US
			req.user.tempUnit = (place.countrycode == 'US' ? 'f' : 'c');
			
			//Pull weather data for new location
			var yweather = new gadgets.Yweather(req.user);
			yweather.update(app, function(err) {
				//Update database
				req.db.collection('users').updateById(req.user._id, req.user, function(err) {
					if (error(err, next)) return;

					//Send new data
					res.json({
						yweather: {
							text: yweather.value,
							uri: yweather.uri
						}
					});
				});
			});
		});
	});

	//DELETE Yweather
	app.del('/dashboard/yweather', auth.middleware(true, '/'), function(req, res, next) {
		delete req.user.gadgets.yweather;

		//Update database
		req.db.collection('users').updateById(req.user._id, req.user, function(err) {
			if (error(err, next)) return;

			//Send new data
			res.send(200);
		});
	});

	//PUT new account
	app.all('/dashboard/:service', function(req, res, next) {
		//Skip DELETEs and requests to Yweather
		if (req.method === 'DELETE' || !req.service) {
			return next();
		}

		//Make sure PUT method is specified either via _method in POST body
		//or via _method in GET querystring (the latter is necessary for OAuth redirects)
		if (req.method !== 'PUT' && 
			!(req.method === 'GET' && 
			  req.query._method &&
			  req.query._method.toUpperCase() === 'PUT' &&
			  req.query.complete ||
			  req.user.accounts[req.params.service] !== undefined))
		{
			//Method not allowed
			res.send(405);
			return;
		}

		//Provide URI for callbacks as used by OAuth
		var completeUri = app.set('uri') + 'dashboard/' + req.service.name.toLowerCase() + '?' +
			qs.stringify({
				_method: 'put',
				complete: 1
			});

		if (!req.query.complete) {
			//connect() can handle the request on its own or call setupAccount()
			req.service.connect(req, res, next, completeUri, setupAccount);
		} else {
			req.service.completeConnection(req, res, next, completeUri, setupAccount);
		}

		//Initialises the gadgets associated with the given account,
		//save the updated data and redirect the user to the dashboard
		//or respond with JSON to AJAX requests
		function setupAccount(err, account) {
			if (error(err, next)) return;
			
			//Add new account
			req.user.accounts[req.service.name.toLowerCase()] = account;

			//Gather updated gadget data for JSON response
			var gadgetData = { };

			//Set up all of this service's gadgets simultaneously
			async.each(req.service.gadgets, function(gadget, gadgetCb) {
				//Instantiate gadget
				gadget = new gadget(req.user);

				//Create task list for availability check and initial update
				var tasks = [ ];

				//If the gadget provides an availability check
				if (gadget.checkAvailability) {
					tasks.push(function(availabilityCb) {
						//Check for availability
						gadget.checkAvailability(app, function(available) {
							//Delete if unavailable
							if (!available) {
								delete req.user.gadgets[gadget.gadgetName.toLowerCase()];
								availabilityCb(new Error('Gadget unavailable'));
							} else {
								availabilityCb();
							}
						});
					});
				}

				//Run initial update
				tasks.push(function(updateCb) {
					gadget.update(app, function(err) {
						//Gather gadget data for JSON response
						gadgetData[gadget.gadgetName.toLowerCase()] = {
							text: gadget.value,
							uri: gadget.uri
						};

						updateCb();
					});
				});

				//Run availability check and initial update in sequence
				async.waterfall(tasks, function(err) {
					gadgetCb();
				});
			}, function() {
				//Save updated data
				req.db.collection('users').updateById(req.user._id, req.user, function(err) {
					if (error(err, next)) return;

					//Redirect regular requests to dashboard
					if (!req.xhr) {
						res.redirect('/dashboard#settings');
					//Reply with JSON to AJAX requests
					} else {
						res.json(201, gadgetData);
					}
				});
			});
		}
	});

	app.del('/dashboard/:service', function(req, res, next) {
		//When possible, disonnect from service (e.g. revoke the access token)
		if (req.service.disconnect) {
			var accountData = req.user.accounts[req.service.name.toLowerCase()];
			req.service.disconnect(app, accountData, function(err) {
				if (error(err, next)) return;
				deleteAccount();
			});
		} else {
			deleteAccount();
		}

		function deleteAccount() {
			//Delete account
			delete req.user.accounts[req.service.name];

			//Delete gadgets that belonged to the account
			req.service.gadgets.forEach(function(gadget) {
				delete req.user.gadgets[gadget.gadgetName.toLowerCase()];
			});

			//Update database
			req.db.collection('users').updateById(req.user._id, req.user, function(err) {
				if (error(err, next)) return;

				res.send(200);
			});
		}
	});
};