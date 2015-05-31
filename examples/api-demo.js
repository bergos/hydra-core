/**
 * This example registers a new user at the Hydra Issue Tracker Demo application [1]. That user is used to create a new
 * issue. The issue and user will be deleted afterwards, if "dontDelete" is not changed to "true". The Hydra Console [2]
 * can be used to view the created objects.
 *
 * [1] http://www.markus-lanthaler.com/hydra/api-demo/
 * [2] http://www.markus-lanthaler.com/hydra/console/
*/

global.Promise = require('es6-promise').Promise;


/**
 * !!! change this to true if you want to keep the created objects !!!
 */
var dontDelete = false;


var
  hydra = require('../hydra-core');


var ns = {
  Issue: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#Issue',
  User: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#User',
  issues: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#EntryPoint/issues',
  registerUser: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#EntryPoint/registerUser'
};


var config = {
  base: 'http://www.markus-lanthaler.com',
  user: 'hydracore',
  email: 'hydracore@test.com',
  password: '123456'
};


var user = {
  '@context': {
    '@vocab': ns.User + '/'
  },
  '@type': ns.User,
  name: config.user,
  email: config.email,
  password: config.password
};


var issue = {
  '@context': {
    '@vocab': ns.Issue + '/'
  },
  '@type': ns.Issue,
  title: 'Hydra Core test issue',
  description: 'Test issues created by Hydra Core',
  is_open: true
};


Promise.resolve()
  .then(function () {
    return hydra.loadUrl(config.base + '/hydra/api-demo/')
      .then(function (document) {
        // find "register user" operation using property IRI and method
        var registerUser = document.findOperation(ns.registerUser, 'POST').invoke;

        // find "create issue" operation using property IRI and method
        var createIssue = document.findOperation(ns.issues, 'POST').invoke;

        // invoke "register user" operation
        return registerUser(user)
          .then(function (response) {
            user = response;

            console.log('created user <' + user['@id'] + '>');
          })
          .then(function () {
            // invoke "create issue" operation using basic authentication
            return createIssue(issue, {user: config.email, password: config.password});
          })
          .then(function (response) {
            issue = response;

            console.log('created issue <' + issue['@id'] + '>');
        });
     })
  })
  .then(function () {
    if (dontDelete) {
      return Promise.resolve();
    }

    return hydra.loadUrl(config.base + issue['@id'])
      .then(function (document) {
        // find "delete" class operation
        var deleteIssue = document.findOperation('DELETE').invoke;

        // invoke "delete" operation using basic authentication
        return deleteIssue(null, {user: config.email, password: config.password})
          .then(function () {
            console.log('deleted issue <' + issue['@id'] + '>');
          });
      });
  })
  .then(function () {
    if (dontDelete) {
      return Promise.resolve();
    }

    return hydra.loadUrl(config.base + user['@id'])
      .then(function (document) {
        // find "delete" class operation
        var deleteUser = document.findOperation('DELETE').invoke;

        // invoke "delete" operation using basic authentication
        return deleteUser(null, {user: config.email, password: config.password})
          .then(function () {
            console.log('deleted user <' + user['@id'] + '>');
          });
      });
  })
  .catch(function (error) {
    console.error(error.stack);
  });
