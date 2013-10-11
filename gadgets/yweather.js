var http = require('http'),
	qs = require('querystring'),
	request = require('request'),
	xml = require('xml-mapping'),
	assembleGadget = require('./factory').assembleGadget,
	error = require('../lib/error');

module.exports = assembleGadget({
	name: 'Yweather',
	update: function(app, callback) {
		if (!this.user.location.woeid) {
			return error('Location unknown', callback);
		}

		request({
			url: 'http://weather.yahooapis.com/forecastrss',
			qs: {
				w: this.user.location.woeid,
				u: this.user.tempUnit
			}
		}, function(err, res, body) {
			if (error(err, res, callback)) return;
					
			//Extract temperature and link to forecast
			try {
				var doc = xml.load(body);

				callback(null, {
					value: doc.rss.channel.item.yweather$condition.temp,
					uri: doc.rss.channel.link.$t
				});
			}
			catch (err) {
				error(err, res, callback);
			}
		});
	},
	intervals: [
		     3 * 60 * 60,       15 * 60, //3h after login, update every 15m
		    24 * 60 * 60,       60 * 60, //1d after login, update every 1h
		7 * 24 * 60 * 60,   2 * 60 * 60 // 1w after login, update every 2h
	]
});

module.exports.getWoeid = function(app, location, callback) {
	//Using node.js http module instead of request.js because request.js 
	//automatically escapes the request path, which causes the Yahoo API to fail
	http.get({
		host: 'where.yahooapis.com',
		port: 80,
		path: "/v1/places$and(.q('" + qs.escape(location) + 
			  "'),.type(7))?appid=" + app.set('yahoo-appid')
	}, function(res) {
		if (error(res, callback)) return;

		//Receive data
		res.setEncoding('utf8');

		var body = '';
		res.on('data', function(chunk) { 
			body += chunk;
		});
		res.on('end', function() {
			try {
				//Convert XML to JSON for easier usage
				var doc = xml.load(body);

				if (!doc.places.place) {
					throw new Error('Place not found: ' + location);
				}
				
				callback(null, { 
					name: doc.places.place.name.$t, 
					woeid: doc.places.place.woeid.$t,
					countrycode: doc.places.place.country.code.$t
				});
			} catch (err) {
				error(err, res, callback);
			}
		});
	}).on('error', function(err) {
		error(err, callback);
	});
};