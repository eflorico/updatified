var request = require('request'),
	winston = require('winston'),
	error = require('./lib/error');

exports.load = function(app) {
	app.configure(function() {
		//Insert base URI here, including trailing slash
		app.set('uri', 'http://WEBSITE.COM/PATH/');

		//Insert hostname here, without http:// or path
		app.set('host', 'WEBSITE.COM');

		//Salt for password hashing. Mash your keyboard here, and never change this after anyone signed up.
		app.set('salt', 'MASH KEYBOARD HERE');

		//Secret for signing cookies. Mash keyboard once more.
		app.set('secret', 'MASH KEYBOARD AGAIN');

		//Sender email address for password reset emails from Updatified
		app.set('email', 'John Doe <john@doe.com>');

		//Register your app with Google here https://cloud.google.com/console
		//to acquire an appid and a secret
		app.set('google-appid', 'INSERT GOOGLE APPID HERE');
		app.set('google-secret', 'INSERT GOOGLE SECRET HERE');

		//Register your app with Facebook here https://developers.facebook.com/apps
		//to acquire an appid and a secret
		app.set('facebook-appid', 'INSERT FACEBOOK APPID HERE');
		app.set('facebook-secret', 'INSERT FACEBOOK SECRET HERE');

		//Register your app with GeoIO http://www.geoio.com/
		//for 100 free IP geolocation queries/day
		app.set('geoio-key', 'INSERT GEOIO KEY HERE');

		//Register your app with Yahoo here https://developers.facebook.com/apps
		//to acquire an appid
		app.set('yahoo-appid', 'INSERT YAHOO APPID HERE');

		//Register your app with StackExchange here http://stackapps.com/apps/oauth/register
		//to acquire an appid, secret, and key
		app.set('stackexchange-appid', 'INSERT STACKEXCHANGE APPID HERE');
		app.set('stackexchange-secret', 'INSERT STACKEXCHANGE SECRET HERE');
		app.set('stackexchange-key', 'INSERT STACKEXCHANGE KEY HERE');

		//Register your app with GitHub here https://github.com/settings/applications/new
		//to acquire an appid and secret
		app.set('github-appid', 'INSERT GITHUB APPID HERE');
		app.set('github-secret', 'INSERT GITHUB SECRET HERE');

		//Uncomment this to verify your website with
		//Google Webmaster Tools
		//app.set('google-verification', 'INSERT GOOGLE VERIFICATION CODE HERE');

		app.set('port', 80);

		app.winston = winston;

		//Customize logging to console here
		app.winston.remove(winston.transports.Console);
		app.winston.add(winston.transports.Console, {
			level: 'debug',
			colorize: true,
			timestamp: true,
			json: false,
			handleExceptions: true
		});
	});

	app.configure('development', function() {
		//===============================
		//DEVELOPMENT CONFIGURATION
		//===============================
		app.set('db-uri', 'mongodb://INSERT MONGODB URI HERE');

		app.mail = function(options, callback) {
			app.winston.debug('E-Mail to %s: %s\n%s\n', options.to, options.subject, options.text);
			callback();
		};
	});

	app.configure('production', function() {
		//===============================
		//PRODUCTION CONFIGURATION
		//===============================
		app.set('db-uri', 'mongodb://INSERT MONGODB URI HERE');

		//Specify user and group to drop sudo privileges
		//after setting up server
		//app.set('user', 'INSERT USER HERE');
		//app.set('group', 'INSER GROUP HERE');

		app.mail = function(options, callback) {
			//Specify your own function for mail delivery
			//options: {
			//	to: string,
			//	subject: string,
			//	text: string
			//}
			//Access the configured sender email address through app.set('email')
		};

		//Uncomment the following lines to use Mailgun for email delivery
		//Sign up for Mailgun here: https://mailgun.com/signup
		//app.set('mailgun-key', 'INSERT MAILGUN KEY HERE');

		// app.mail = function(options, callback) {
		// 	request({
		// 		uri: 'https://api:' + app.set('mailgun-key') +
		// 			'@api.mailgun.net/v2/INSERT MAILGUN DOMAIN HERE.mailgun.org/messages',
		// 		method: 'POST',
		// 		form: {
		// 			from: app.set('email'),
		// 			to: options.to,
		// 			subject: options.subject,
		// 			text: options.text
		// 		},
		// 		strictSSL: true
		// 	}, function(err, res, body) {
		// 		if (error(err, res, callback)) return;

		// 		callback();
		// 	});
		// };

		//Customize logging to file here
		app.winston.add(winston.transports.File, {
			filename: 'updatified.log',
			maxsize: 1000000,
			maxFiles: 10,
			colorize: false,
			timestamp: true,
			json: false,
			handleExceptions: true
		});
	});
};