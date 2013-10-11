var auth = require('../lib/auth');

exports.registerController = function(app) {
	app.get('/logout', auth.middleware(true, '/'), function(req, res, next) {
		req.session.destroy();
		res.setHeader('session=; Expires=' +
			new Date(+new Date - 24 * 60 * 60 * 1000).toUTCString());
		res.redirect('/');
	});
};