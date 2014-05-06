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
		path: "/v1/places.q('" + qs.escape(location) + "')" +
			  '?lang=en-US&format=json&appid=' + app.set('yahoo-appid')
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
				var doc = JSON.parse(body);

				if (!doc.places.place) {
					throw new Error('Place not found: ' + location);
				}

				var place = doc.places.place[0];

				//Merge all specified layers into one place name string
				var placeLayers = [ 
					'locality2',
					'locality1',
					'admin3',
					'admin2',
					'admin1',
					'country'
				];

				//Gather all possible name parts
				var nameParts = placeLayers.filter(function(layerName) {
					//Reject empty/unspecified parts
					return place[layerName] !== '';
				}).map(function(layerName) {
					return place[layerName];
				}).filter(function(namePart, index, nameParts) {
					//Reject duplicates, preferring higher layers
					return !nameParts.some(function(otherNamePart, otherIndex) {
						//Ignore lower layers that have already been filtered
						if (otherIndex <= index) return false;

						//Case insensitive
						otherNamePart = otherNamePart.toLowerCase();
						namePart = namePart.toLowerCase();

						//Check whether one of the names contains the other
						return otherNamePart.indexOf(namePart) !== -1 ||
							namePart.indexOf(otherNamePart) !== -1;
					});

					//This changes
					//Panjang, Bandar Lampung, Lampung, Republik Indonesia into
					//Panjang, Lampung, Republik Indonesia and
					//Kiel, Stadtteil Dusternbrook, Stadtkreis Kiel, Schleswig-Holstein, Germany into
					//Stadtteil Dusternbrook, Stadtkreis Kiel, Schleswig-Holstein, Germany
				});

				var placeName = nameParts.join(', ');

				callback(null, {
					name: placeName,
					woeid: place.woeid,
					countrycode: place['country attrs'].code
				});
			} catch (err) {
				error(err, res, callback);
			}
		});
	}).on('error', function(err) {
		error(err, callback);
	});
};