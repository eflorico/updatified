var _ = require('underscore'),
	async = require('async'),
	error = require('./lib/error'),
	gadgets = require('./gadgets/gadgets');

//Finds the value of the smallest key that is greater than search
//and returns its value or infinity, if no key has been found
function findInterval(intervals, search) {
	var selectedKey = Infinity;

	//Check all keys, as the order of an object's key is not guaranteed
	for (var key in intervals) {
		key = parseInt(key);
		if (key >= search && key < selectedKey) {
			selectedKey = key;
		}
	}

	if (selectedKey !== Infinity) {
		return intervals[selectedKey.toString()];
	} else {
		return Infinity;
	}
}

function shouldRetreat(gadgetName, user) {
	var retreatIntervals = {
		  '2':           60, //Stop updating for 1m after up to 2 errors
		  '4':       5 * 60, //Stop updating for 5m after up to 4 errors
		  '6':      30 * 60, //Stop updating for 30m after up to 6 errors
		  '8':  2 * 60 * 60, //Stop udpating for 2h after up to 8 errors
		 '16':  6 * 60 * 60, //Stop udpating for 6h after up to 16 errors
		 '23': 24 * 60 * 60  //Stop updating for 24h after up to 112 errors
		                     //After more than 23 errors, updating is halted
	},
	gadget = user.gadgets[gadgetName];

	//Use retreat interval if an error has occured
	if (gadget.consecutiveErrors > 0) {
		var retreatInterval = findInterval(retreatIntervals, gadget.consecutiveErrors);
		return (new Date - gadget.lastUpdate) / 1000 <= retreatInterval
	} else {
		return false;
	}
}

function shouldUpdate(gadgetName, user, intervals) {
	var gadget = user.gadgets[gadgetName];

	//Determine current update interval for this gadget
	//based on when the user was last seen
	var interval = findInterval(intervals[gadgetName],
		(new Date - user.lastActivity) / 1000);

	return (new Date - gadget.lastUpdate) / 1000 >= interval ||
		gadget.lastUpdate === null;
}

//Creates a queue to update gadgets for each user
//Tasks must be added in the following format:
//{
//	user: { User object },
//	gadgets:  [ { Gadget objects } ]
//}
exports.createQueue = function(app, errorCallback) {
	//Keep track of user ids to avoid duplicates in the queue
	var queuedUserIds = [ ],
		runningUserIds = [ ];
	//Manage callbacks outside the async.js task queue to allow adding a
	//callback after enqueuing (when cutqueue is called)
	var callbacks = { };

	//Adds a task to update a user's gadgets to the front (position == true)
	//or end (position == false) of the queue
	function insert(user, gadgets, position, callback) {
		//Abort if there is nothing to update or
		//if this user is already being processed
		if (gadgets.length === 0 ||
			runningUserIds.indexOf(user._id.toString()) !== -1)
		{
			if (callback) {
				callback(false);
			}

			return;
		}

		//Check if this user is already in the queue
		var taskIndex = taskQueue.tasks.indexOf(user._id.toString());

		//Remove user from task queue if found
		if (taskIndex !== -1) {
			taskQueue.splice(taskIndex, 1);
		}
		//Otherwise, add user id for tracking and set up callback entry
		else {
			queuedUserIds.push(user._id.toString());
			callbacks[user._id.toString()] = [ ];
		}

		//Add callback to list of callbacks
		if (callback) {
			callbacks[user._id.toString()].push(callback);
		}

		//Insert user at top of the queue
		if (position) {
			taskQueue.unshift({
				user: user,
				gadgets: gadgets
			});
		//Or append user to the end of the queue
		} else {
			taskQueue.push({
				user: user,
				gadgets: gadgets
			});
		}
	}

	function advance(task) {
		//Remove user from queue
		queuedUserIds.splice(queuedUserIds.indexOf(task.user._id.toString()), 1);

		//Add to currently processed users
		runningUserIds.push(task.user._id.toString());
	}

	function finalize(task) {
		//Remove user from running tasks
		runningUserIds.splice(runningUserIds.indexOf(task.user._id.toString()), 1);

		//Call manually managed callbacks
		_.each(callbacks[task.user._id.toString()], function(callback) {
			callback(true);
		});

		//Remove callbacks
		delete callbacks[task.user._id.toString()];
	}

	//Initialise underlying queue using async.js
	var taskQueue = async.queue(function(task, userCallback) {
		//Move user id to list of users being processed
		advance(task);

		//Gadgets from the same service must not be updated simultaneously
		//to avoid parallel token refreshes

		//Thus, group gadgets by service
		var gadgetsByService = _.values(
			_.groupBy(task.gadgets, function(gadget) {
				if (gadget.account) {
					return 'a' + gadget.account;
				} else {
					return 'g' + gadget.gadgetName;
				}
			})
		);

		var dbQuery = { _id: task.user._id };
		var dbUpdate = { $set: { } };

		//Run update on all services in parallel
		async.each(gadgetsByService, function(gadgets, serviceCallback) {
			//Update gadgets of every service in series
			async.eachSeries(gadgets, function(gadget, gadgetCallback) {
				gadget.update(app, function(err) {
					app.winston.debug('Updated %s to %d',
						gadget.gadgetName,
						task.user.gadgets[gadget.gadgetName.toLowerCase()].value
					);

					//Report errors but carry on
					error(err, errorCallback);

					var name = gadget.gadgetName.toLowerCase();
					dbQuery['gadgets.' + name] = { $exists: true };
					dbUpdate.$set['gadgets.' + name] = task.user.gadgets[name];

					gadgetCallback();
				});
			}, function() {
				if (gadgets[0].account) {
					var name = gadgets[0].account.toLowerCase();
					dbQuery['accounts.' + name] = { $exists: true };
					dbUpdate.$set['accounts.' + name] =	task.user.accounts[name];
				}

				serviceCallback();
			});
		}, function() {
			//Save changes to user
			app.db.collection('users').update(dbQuery, dbUpdate, function(err) {
				//Report errors but carry on
				error(err, errorCallback);

				//Remove user from queues
				finalize(task);

				//Mark user as completed
				userCallback();
			});
		});
	},
		1 //Number of workers
	);

	//Create user queue interface
	var userQueue = {
		//Appends a user and his gadgets to the end of the queue
		enqueue: function(user, gadgets, callback) {
			insert(user, gadgets, false, callback);
		},
		//Inserts a user and his gadgets at the beginning of the queue
		cutqueue: function(user, gadgets, callback) {
			insert(user, gadgets, true, callback);
		},
		drain: null
	};

	//Pass on drain event
	taskQueue.drain = function() {
		if (userQueue.drain) {
			userQueue.drain();
		}
	};

	return userQueue;
};

exports.autoPopulateQueue = function(app, queue, errorCallback) {
	async.forever(function(callback) {
		gatherStaleGadgets(app, function(err, result) {
			//In case of error, report and retry after 30s
			if (error(err, result, errorCallback)) {
				setTimeout(callback, 30000);
				return;
			}

			//If no gadgets have to be updated, wait 500ms before checking again
			if (result.length === 0) {
				setTimeout(callback, 500);
			}

			//Notify async.forever of task completion
			//when all users have been processed
			queue.drain = callback;

			//Prepare map/reduce results for processing
			_.each(result, function(item) {
				var staleGadgets = [ ];

				//Convert lowercase gadget names to gadget objects
				//by looping over all existing gadgets since we cannot
				//convert the lowercase name to the original name
				for (var gadgetName in gadgets) {
					if (item.value.gadgets.indexOf(gadgetName.toLowerCase()) !== -1) {
						//Create gadget object
						staleGadgets.push(new (gadgets[gadgetName])(item.value.user));
					}
				}

				//Enqueue this user's gadgets
				queue.enqueue(item.value.user, staleGadgets);
			});
		});
	});
};

//Gather stale gadgets from the database using map/reduce in format
//[ {
//	user: { User object },
//	gadgets: [ "Lowercase stale gadget names"]
//} ]
function gatherStaleGadgets(app, callback) {
	//Maps a user to the format specified above
	function map() {
		//Update and retreat intervals will be inserted later
		//(Seconds since last update): (Update interval in seconds)
		var intervals = { /* UPDATE INTERVALS */ },
			findInterval = 0 /* findInterval() */,
			shouldUpdate = 0 /* shouldUpdate() */,
			shouldRetreat = 0 /* shouldRetreat() */;

		//Contains gadgets to update
		var staleGadgets = [ ];

		for (var gadgetName in this.gadgets) {
			if (shouldUpdate(gadgetName, this, intervals) &&
				!shouldRetreat(gadgetName, this))
			{
				staleGadgets.push(gadgetName);
			}
		}

		if (staleGadgets.length > 0) {
			emit(this._id, {
				user: this,
				gadgets: staleGadgets
			});
		}
	}

	//Dummy reduce function
	function reduce(key, values) {
		return values[0];
	}

	//Collect update intervals from gadgets
	var intervals = { };
	for (var gadgetName in gadgets) {
		intervals[gadgetName.toLowerCase()] = gadgets[gadgetName].intervals;
	}

	//Insert intervals into function - function is passed to MongoDB as string
	map = map.toString().replace(
		'{ /* UPDATE INTERVALS */ }',
		JSON.stringify(intervals)
	).replace(
		'0 /* findInterval() */',
		findInterval.toString()
	).replace(
		'0 /* shouldUpdate() */',
		shouldUpdate.toString()
	).replace(
		'0 /* shouldRetreat() */',
		shouldRetreat.toString()
	);

	//Ignore inactive users
	var minDate = new Date(new Date() - 1000 * 60 * 60 * 24 * 7); //1w

	//Let users who are currently active perform updates via AJAX for less delay
	//between the database update and the user receiving the fresh data
	var maxDate = new Date(new Date() - 1000 * 20);

	//Perform map/reduce
	app.db.collection('users').mapReduce(map, reduce, {
		query: { lastActivity: { $gte: minDate, $lt: maxDate } },
		out: { inline: true }
	}, callback);
}