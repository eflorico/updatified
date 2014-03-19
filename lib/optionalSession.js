//OptionalSession can be used after initialising connect.session().
//It stymies the automatic session creation by connect.session() by
//automatically removing empty sessions
module.exports = function() {
	return function optionalSession(req, res, next) {
		//Proxy response.end()
		var end = res.end;
		res.end = function(data, encoding) {
			var isEmpty = true;

			//Check if session has been used
			for (var key in req.session) {
				if (req.session.hasOwnProperty(key) && key !== 'cookie') {
					isEmpty = false;
					break;
				}
			}

			//If session is empty, remove from request so as to prevent
			//unecessary cookie creation.
			//Please note that this does not destroy neither the cookie nor
			//the storage entry for existing sessions that have been emptied.
			if (isEmpty) {
				delete req.session;
			}

			//Call original response.end()
			res.end = end;
			res.end(data, encoding);
		};

		next();
	};
};