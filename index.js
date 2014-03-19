var express = require('express'),
	fs = require('fs'),
	scheduler = require('./scheduler');

exports.run = function(configure) {
	//This is the main object for the express app
	var app = express();

	//Initialise app
	configure(app);

	//Walks the directory tree and loads all controller files
	fs.readdirSync(__dirname + '/controllers')
		.forEach(function(file) {
			if (file.substr(-3) === '.js') {
				//Load controller
				require(__dirname + '/controllers/' + file)
					.registerController(app);
			}
		});

	//Update gadgets continuously in the background
	app.queue = scheduler.createQueue(app, app.error);
	scheduler.autoPopulateQueue(app, app.queue, app.error);

	//Start express http server
	app.listen(app.set('port'));

	//Drop root privileges if possible
	if (app.set('user') && app.set('group')) {
		process.setgid(app.set('user'));
		process.setuid(app.set('group'));

		app.winston.info('Server\'s UID is now %d', process.getuid());
	}

	app.winston.info('Updatified up and running on port %d in %s environment',
		app.set('port'), app.settings.env);
};