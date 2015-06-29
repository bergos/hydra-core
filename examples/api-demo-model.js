(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('../'));
  } else {
    factory(hydra);
  }
})(this, function (hydra) {
  /**
   * This example registers a new user at the Hydra Issue Tracker Demo application [1]. That user is used to create a new
   * issue. The issue and user will be deleted afterwards, if "dontDelete" is not changed to "true". The Hydra Console [2]
   * can be used to view the created objects.
   *
   * [1] http://www.markus-lanthaler.com/hydra/api-demo/
   * [2] http://www.markus-lanthaler.com/hydra/console/
   */

  /**
   * !!! change this to true if you want to keep the created objects !!!
   */
  var dontDelete = false;


  var ns = {
    EntryPoint: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#EntryPoint',
    Issue: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#Issue',
    User: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#User',
    issues: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#EntryPoint/issues',
    registerUser: 'http://www.markus-lanthaler.com/hydra/api-demo/vocab#EntryPoint/registerUser'
  };


  var config = {
    //base: 'http://www.markus-lanthaler.com',
    base: 'http://localhost:8080',
    user: 'hydracore',
    email: 'hydracore@test.com',
    password: '123456'
  };


  var credentials = {
    user: config.email,
    password: config.password
  };


  var entryPointContext = {
    '@context': {
      '@vocab': ns.EntryPoint + '/'
    }
  };


  var userContext = {
    '@context': {
      '@vocab': ns.User + '/'
    }
  };


  var userData = {
    '@context': {
      '@vocab': ns.User + '/'
    },
    // no need to define @type here, because it will be injected with the model
    name: config.user,
    email: config.email,
    password: config.password
  };


  var issueData = {
    '@context': {
      '@vocab': ns.Issue + '/'
    },
    // no need to define @type here, because it will be injected with the model
    title: 'Hydra Core test issue',
    description: 'Test issues created by Hydra Core',
    is_open: true
  };


  hydra.model.load(config.base + '/hydra/api-demo/', entryPointContext)
    .then(function (entryPoint) {
      console.log('loaded entry point: <' + entryPoint.document.iri + '>');

      return Promise.all([
        hydra.model.create(entryPoint.api.findClass(ns.User), userData),
        hydra.model.create(entryPoint.api.findClass(ns.Issue), issueData)
      ]).then(function (result) {
        var user = result[0];
        var issue = result[1];

        console.log('created user from abstract class with name: ' + user.name);
        console.log('created issue from abstract class with title: ' + issue.title);

        return entryPoint.registerUser['@post'](user, userContext)
          .then(function (registeredUser) {
            console.log('registered user as: <' + registeredUser['@id'] + '>');

            return entryPoint.issues['@post'](issue, credentials)
              .then(function (createdIssue) {
                console.log('submitted issue as: <' + createdIssue['@id'] + '>');

                if (dontDelete) {
                  return;
                } else {
                  return createdIssue['@delete'](null, credentials);
                }


              })
              .then(function () {
                if (dontDelete) {
                  return;
                } else {
                  console.log('deleted issue');

                  return registeredUser['@delete']();
                }
              })
              .then(function () {
                if (!dontDelete) {
                  console.log('deleted user');
                }
              });
          });
      });
    })
    .catch(function (error) {
      console.error(error.stack);
    });
});