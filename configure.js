var _ = require('underscore'),
	express = require('express'),
	mongo = require('mongoskin'),
	MongoStore = require('connect-mongo')(express),
	winston = require('winston'),
	error = require('./lib/error'),
	optionalSession = require('./lib/optionalSession');

exports.configure = function(app) {
	//Load configuration
	require('./config').load(app);

	//Initialise database
	app.db = mongo.db(app.set('db-uri'), { safe: true });

	app.use(function(req, res, next) {
		req.db = app.db;
		next();
	});

	//Error logging
	app.error = function(err) {
		err = error(err) || err;

		function escapeForRegExp(str) {
			return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
		}

		//Trim working directory from stack trace
		var stackTrace = err.stack.replace(new RegExp(escapeForRegExp(process.cwd()), 'g'), '.');

		//Turn parts of the stack trace that belong to npm modules gray
		var coloredStackTrace = stackTrace.replace(/^.*\.\/node_modules\/.*$/gm, '\x1B[90m$&\x1B[39m')

		for (var transportName in app.winston.default.transports) {
			var transport = app.winston.default.transports[transportName];
			transport.log(
				'error',
				err.toString().trim() + '\n' +
				(transport.colorize ? coloredStackTrace : stackTrace) + '\n   ',
				{ data: err.data, innerError: err.innerError },
				function() { }
			);
		}
	}

	app.configure('development', function() {
		app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
	});

	app.configure('production', function() {
		app.use(express.errorHandler({ dumpExceptions: false, showStack: false }));

		//Emergency error handling
		winston.handleExceptions();
	});

	app.configure(function() {
		//Set up Jade as view engine
		app.set('views', __dirname + '/views');
		app.set('view engine', 'jade');
		app.set('view options', { layout: false });

		//Redirect to host specified in config
		app.use(function(req, res, next) {
			if (req.host != app.set('host')) {
				res.redirect(301, req.protocol + '://' + app.set('host') + req.url);
			} else {
				next();
			}
		});

		//Set up cookie parser
		app.use(express.cookieParser(app.set('secret')));

		//Set up sessions with MongoDB as session store
		app.use(express.session({
			key: 'session',
			store: new MongoStore({
				url: app.set('db-uri'),
				auto_reconnect: true
			}),
			cookie: {
				path: '/',
				httpOnly: true,
				maxAge: 20 * 365 * 24 * 60 * 60 * 1000 //20 years
			}
		}));


		//Disable automatic session creation
		app.use(optionalSession());

		//Set up body parser to process the payload of POST requests
		app.use(express.bodyParser());

		//Allow setting of method using _method GET or POST parameter
		//so that PUT and DELETE can be used
		app.use(express.methodOverride());

		//Serve static files from "public" directory
		app.use(express.static(__dirname + '/public', { maxAage: 365 * 24 * 60 * 60 * 1000 }));

		app.use(function(req, res, next) {
			app.winston.info(req.method + ' ' + req.url);
			next();
		});

  		//Set up express.js routing
		app.use(app.router);

		app.use(function(err, req, res, next) {
			if (err) {
				app.error(err);
				res.send(500, 'Sorry, something went wrong — we\'re looking into it. ' +
					'Does it work when you try again?');
			}
		});
	});
};