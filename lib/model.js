var
  hydra = require('./core'),
  utils = require('./utils'),
  _ = utils.require('lodash'),
  jsonldp = utils.require('jsonld').promises();


hydra.model = {};


/**
 * Creates an invoke function for model objects that compacts the response using the given context
 *
 * @param operation
 * @returns {Function}
 */
hydra.model.createHttpJsonLdInvoke = function (operation) {
  return function (input, options) {
    options = options || {};

    var context = {};

    if ('@context' in this) {
      context = this['@context'];
    }

    context = options.context || context;

    if (input && input.toJSON) {
      input = input.toJSON();
    }

    return hydra.httpClient.rawJsonLdInvoke.call(operation, input, options)
      .then(function (response) {
        if (!response.body) {
          return Promise.resolve(null);
        }

        return hydra.documentFromResponse(response)
          .then(function (document) {
            return jsonldp.compact(response.body, context)
              .then(function (output) {
                return hydra.model.create(document.classes, output);
              });
          });
      });
  };
};

/**
 * Converts a model object to serializable object without functions and property flagged with @omit
 */
hydra.model.toJSON = function () {
  var copyProperties = function (object, root) {
    if (!object) {
      return null;
    }

    var copy = _.keys(object).reduce(function (json, key) {
      var value = object[key];

      // don't add function properties
      if (_.isFunction(value)) {
        return json;
      }

      // don't add properties with @omit flag
      if (_.isObject(value) && '@omit' in value && value['@omit']) {
        return json;
      }

      if (_.isObject(value)) {
        // copy sub properties
        json[key] = copyProperties(value, root);
      } else {
        // copy string values
        json[key] = value;
      }

      return json;
    }, {});

    // convert to Array if original object was an Array
    if (_.isArray(object)) {
      copy = _.values(object);
    }

    return copy;
  };

  return copyProperties(this);
};

/**
 * Adds a @omit property to an object to hide it from serialization
 *
 * @param property
 * @returns {Object}
 */
hydra.model.hide = function (property) {
  property['@omit'] = true;

  return property;
};

/**
 * Creates a model object based on one or more classes
 *
 * @param classes The class or classes the model will be bases on
 * @param properties Properties to merge into the model object
 * @param options Additional options to control the model creation
 * @returns {*}
 */
hydra.model.create = function (classes, properties, options) {
  var processOperations = function (root, operations) {
    operations.forEach(function (operation) {
      var key = '@' + operation.method.toLowerCase();

      if (!(key in root)) {
        root[key] = options.createInvoke(operation).bind(model);
      }
    });

    return Promise.resolve();
  };

  var processProperties = function (root, properties) {
    return Promise.all(properties.map(function (property) {
      return utils.compactIri(property.iri, model['@context'])
        .then(function (key) {
          if (!(key in root)) {
            root[key] = {};
          }

          return processOperations(root[key], property.operations);
        });
    }));
  };

  var processClass = function (apiClass) {
    model['@type'].push(apiClass.iri);

    return processOperations(model, apiClass.operations)
      .then(function () {
        return processProperties(model, apiClass.properties);
      });
  };

  classes = utils.toArray(classes);

  options = options || {};
  options.createInvoke = options.createInvoke || hydra.defaults.model.createInvoke;

  var model = _.clone(properties);

  _.defaults(model, {
    '@context': {},
    toJSON: hydra.model.toJSON
  });

  model['@type'] = [];
  model.api = classes[0].api || classes[0].abstract.api;
  model.api['@omit'] = true;

  if (classes[0].document) {
    model.document = classes[0].document;
    model.document['@omit'] = true;
  }

  return Promise.all(classes.map(function (apiClass) {
    return processClass(apiClass);
  })).then(function () {
    return model;
  });
};

/**
 * Creates a model object based on a GET request to the given URL
 *
 * @param url URL
 * @param properties Properties that will be merged into the model object
 * @param options Options for the request
 * @returns {Promise}
 */
hydra.model.load = function (url, properties, options) {
  return hydra.loadDocument(url)
    .then(function (document) {
      return hydra.model.create(document.classes, properties, options);
    });
};
