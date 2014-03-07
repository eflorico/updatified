var express = require('express'),
	mongo = require('mongoskin'),
	MongoStore = require('connect-mongo')(express),
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

	app.configure('development', function() {
		app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
	});

	app.configure('production', function() {
		app.use(express.errorHandler({ dumpExceptions: false, showStack: false })); 

		//Emergency error handling
		process.on('uncaughtException', function(error) {
			console.error(new Date().toISOString() + ' *** UPDATIFIED CRASH ***');
			console.error(error);
			console.error(error.stack);
			process.exit(1);
		});
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
			store: new MongoStore({ url: app.set('db-uri') }),
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

		//Set up gzip/deflate compression
		app.use(express.compress());

		//Serve static files from "public" directory
		app.use(express.static(__dirname + '/public', { maxAage: 365 * 24 * 60 * 60 * 1000 }));
  		
  		//Set up express.js routing
		app.use(app.router);
	});
};