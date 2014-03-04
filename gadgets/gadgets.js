var Gadgets = { };

//Load gadgets in predefined order
[ 
	'Gmail',
	'Gcal',
	'OldReader',
	'FbNotifications',
	'Forrst',
	'SeNotifications',
	'GitHub',
	'Yweather'
].forEach(function(name) {
	Gadgets.__defineGetter__(name, function() {
		//Lazy loading to mitigate circular references between
		//accounts/google.js and gadgets/gcal.js as well as gadgets/gmail.js.
		return require(__dirname + '/' + name.toLowerCase() + '.js');
	});
});

module.exports = Gadgets;