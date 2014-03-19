var request = require('request'),
	error = require('./error');

exports.locateIp = function(app, ip, callback) {
	//Use first IP when multiple are specified
	ip = ip.split(',')[0];

	request({
		uri: 'http://api.geoio.com/q.php',
		qs: {
			key: app.set('geoio-key'),
			qt: 'geoip',
			d: 'pipe',
			q: ip
		}
	}, function(err, res, body) {
		if (error(err, res, callback)) return;

		var parts = body.split('|');
		if (parts.length !== 7) {
			return error('Malformed GeoIO response', res, callback);
		}

		callback(false, {
			area: parts[0],
			province: parts[1],
			country: parts[2],
			provider: parts[3],
			latitude: parts[4],
			longitude: parts[5],
			countrycode: parts[6],
			autodetected: true
		});
	});
};