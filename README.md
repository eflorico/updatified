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
 -  Make sure your server and MongoDB is sufficiently secured against attacks.
 -  Change the branding and perhaps the design: All relevant files can be found inside the `public` folder.
 -  Create a production configuration and set the environment variable `NODE_ENV=production`.