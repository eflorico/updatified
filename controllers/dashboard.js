var async = require('async'),
	_ = require('underscore')._,
	auth = require('../lib/auth'),
	error = require('../lib/error'),
	facebook = require('../accounts/facebook.js'),
	gadgets = require('../gadgets/gadgets');

exports.registerController = function(app) {
	//Require login
	app.get(/^\/(dashboard|settings)$/, auth.middleware(true, '/'));

	//Show dashboard with gadgets
	app.get(/^\/(dashboard|settings)$/, function(req, res, next) {
		//Find user's gadgets
		var userGadgets = { };
		_.each(gadgets, function(gadget, name) {
			if (req.user.gadgets[name.toLowerCase()]) {
				userGadgets[name] = new gadget(req.user);
			}
		});

		//Regular request
		if (!req.xhr) {
			//Renew Facebook access token when expiry is imminent
			var fb = req.user.accounts.facebook;

			if (fb && new Date(fb.expires) - new Date <= 24 * 60 * 60 * 1000) {
				res.redirect(app.set('uri') + 'dashboard/facebook?_method=put');
			}

			//Build location string for usage in view
			var location = _.values(_.pick(req.user.location || [ ],
				[ 'area', 'province', 'country' ])).join(', ');

			//Render view
			res.render('dashboard', {
				stylesheet: 'dashboard',
				gadgets: gadgets,
				userGadgets: userGadgets,
				activeGadgetCount: _.size(userGadgets),
				location: location
			});

			app.winston.debug('%s %s complete', req.method, req.url);
		//AJAX request for live updating
		} else {
			//Find stale data
			var staleGadgets = _.filter(userGadgets, function(gadget, name) {
				var age = new Date - req.user.gadgets[name.toLowerCase()].lastUpdate;

				//Shortest interval is used for AJAX updating
				var minAge = _.min(gadgets[name].intervals) * 1000;

				return age >= minAge;
			});

			//Request immediate update of user
			app.queue.cutqueue(req.user, staleGadgets, function(updated) {
				//Return JSON
				var gadgetData = { };

				_.each(userGadgets, function(gadget, name) {
					gadgetData[name.toLowerCase()] = gadget.value;
				});

				res.json(gadgetData);

				app.winston.debug('%s %s complete', req.method, req.url);
			});
		}
	});
};