Updatified
==========

Updatified is a web app that allows its users to get real-time updates on emails, appointments, and notifications all in one place.

Live version
-----------

See Updatified in action at http://updatified.com/

Set up your own
-----------
 1.  Install [Node](http://nodejs.org/) and [MongoDB](http://www.mongodb.org/downloads).
 2.  Clone Updatified: `git clone git@github.com:elektrowolf/updatified.git`
 3.  Copy `config.template.js` to `config.js` and follow the configuration instructions in the comments.
 4.  Start MongoDB: `mongod`
 5.  Start Updatified: `sudo node server.js`

Before you go live
----------
 -  Make sure your server and MongoDB are sufficiently secured against attacks.
 -  Change the branding and design: all relevant files can be found inside the `public` and `views` folders.
 -  Create a production configuration in your `config.js` and set the environment variable `NODE_ENV=production` when running Node with Updatified.