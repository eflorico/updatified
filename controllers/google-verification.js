exports.registerController = function(app) {
	if (app.get('google-verification')) {
		app.get('/google' + app.get('google-verification') + '.html', function(req, res) {
			res.send('google-site-verification: ' + app.get('google-verification') + '.html');
		});
	}
};