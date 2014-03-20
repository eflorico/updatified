var http = require('http'),
	_ = require('underscore');

//Calls the callback with an Error object containing the supplied information
//when an error has occured. Returns true if an error has occured.
//
//To be used as follows: if (error(...)) return;
module.exports = function(message, error, data, callback) {
	//Make message paramater optional
	if (typeof message !== 'string') {
		callback = data;
		data = error;
		error = message;
		message = null;
	}

	//Skip error parameter when HTTP response was supplied instead
	if (error instanceof http.IncomingMessage) {
		callback = data;
		data = error;
		error = null;
	}

	//Make data parameter optional
	if (typeof data === 'function') {
		callback = data;
		data = null;
	}

	var isHttpError = data instanceof http.IncomingMessage &&
		data.statusCode >= 400 && data.statusCode <= 599;

	//No error has occured, abort
	if (!error && !isHttpError) {
		return false;
	}

	//Add message to HTTP errors
	if (!error && isHttpError && !message) {
		message = 'HTTP ' + data.statusCode;
	}

	//When a HTTP response has been supplied, use WebError
	if (data instanceof http.IncomingMessage) {
		if (!message && error && error.message) {
			message = error.message;
		}

		error = new WebError(message, error, data);
	//When an Error object has been passed, reuse it
	} else if (error instanceof Error) {
		if (message) error.message = [ message, error.message ].join(': ');
		if (data) error.data = data;
	} else if (typeof error == 'string') {
		error = new Error([ message, error ].join(': '));
		if (data) error.data = data;
	//Otherwise, create a new Error object
	} else {
		var innerError = error;
		error = new Error(message);
		error.innerError = innerError;
		error.data = data;
	}

	if (typeof callback === 'function') {
		callback(error);
	}

	return error;
};

WebError.prototype = new Error;
WebError.prototype.constructor = WebError;
WebError.prototype.name = 'WebError';

function WebError(message, error, response) {
	this.timestamp = new Date;
	this.innerError = error;
	this.response = response;

	//Store the HTTP request that caused this response (supplied by request.js)
	if (response) {
		this.request = response.request || null;
	} else {
		this.request = null;
	}

	Error.call(this, message);

	//Use existing stack if possible
	if (this.innerError && this.innerError.stack) {
		this.stack = this.innerError.stack;
	} else {
		this.stack = (new Error).stack;
	}
}

WebError.prototype.toString = function() {
	var description = this.timestamp.toISOString() + ': ' +
		(this.message || 'Web error') + '\n';

	//List HTTP request and response details
	_.each({
		'>': this.request,
		'<': this.response
	}, function(httpMessage, arrow) {
		//Skip if message has not been supplied
		if (!httpMessage) return;

		//Show method und URI for request
		if (httpMessage.method) {
			description += '  ' + arrow + ' ' +
				httpMessage.method.toUpperCase() + ' ';

			if (httpMessage.url) {
				description += httpMessage.url.href + '\n';
			} else if (httpMessage.uri) {
				description += httpMessage.uri.href + '\n';
			}
		//Show status code for response
		} else {
			description += '  ' + arrow + ' HTTP ' +
				httpMessage.statusCode + '\n';
		}

		if (httpMessage.headers) {
			for (var header in httpMessage.headers) {
				description += '    ' + header + ': ' +
					httpMessage.headers[header] + '\n';
			}
		}

		if (httpMessage.body) {
			description +=
				'---------------- Body ----------------\n' +
				httpMessage.body + '\n' +
				'------------- End of body ------------\n';
		}
	});

	return description;
};