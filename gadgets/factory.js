var error = require('../lib/error');

/*
Creates a gadget constructor function(user) from the given gadget details
options: {
	name: string,
	[ account: string, ]
	[ uri: string, ] can alternatively be provided by update()
	update: function(err, callback({ value: number, uri: string })),
	[ checkAvailability: function(app, callback(boolean)), ]
	intervals: array; maps the time since the user was last seen 
		to an update interval. All timespans are specified in seconds.
		An array is used instead of an object as object notation does not
		allow numeric keys or keys consisting of caluclations.
}
*/
exports.assembleGadget = function(options) {
	var gadget = function(user) {
		//Calling the constructor adds the gadget to the specified user
		if (user.gadgets[options.name.toLowerCase()] === undefined) {
			user.gadgets[options.name.toLowerCase()] = {
				value: null,
				lastUpdate: null,
				consecutiveErrors: 0
			};
		}

		this.gadgetName = options.name;
		this.account = options.account;
		this.user = user;
		this.data = user.gadgets[options.name.toLowerCase()];

		this.__defineGetter__('value', function() {
			return this.data.value;
		});

		this.__defineGetter__('uri', function() {
			return this.data.uri || options.uri;
		});

		var self = this;

		//Expose update function wrapped with error handling
		this.update = function(app, callback) {
			options.update.call(this, app, function(err, data) {
				self.data.lastUpdate = new Date;

				if (err = error('Could not update ' + options.name, err)) {
					//Register error to delay updating
					self.data.consecutiveErrors++;

					callback(err);

					return;
				}

				self.data.value = data.value;
				if (data.uri) {
					self.data.uri = data.uri;
				}
				
				self.data.consecutiveErrors = 0;

				callback();
			});
		};

		if (options.checkAvailability) {
			this.checkAvailability = options.checkAvailability;
		}
	};

	//Static variables
	gadget.gadgetName = options.name;
	gadget.account = options.account;

	//Transform interval array into object
	gadget.intervals = { };
	for (var i = 0; i < options.intervals.length; i += 2) {
		gadget.intervals[options.intervals[i]] = options.intervals[i + 1];
	}

	return gadget;
}