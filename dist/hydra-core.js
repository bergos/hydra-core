(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.hydra = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var
  hydra = require('./lib/core'),
  utils = require('./lib/utils');


require('./lib/http-client');
require('./lib/model');
require('./lib/validation');


hydra.loadApi = function (url) {
  return hydra.httpClient.request('GET', url)
    .then(function (response) {
      return hydra.api(response.body, url);
    })
    .then(function (api) {
      api.iri = url;

      return api;
    });
};


hydra.documentFromResponse = function (response) {
  return hydra.httpClient.apiLink(response.headers, response.request.url)
    .then(function (apiUrl) {
      return hydra.loadApi(apiUrl);
    })
    .then(function (api) {
      return hydra.document(api, response.body, response.request.url);
    })
    .then(function (document) {
      return hydra.httpClient.contentLocation(response.headers, response.request.url)
        .then(function (contentLocation) {
          document.iri = contentLocation || response.request.url;

          return document;
        });
    });
};


hydra.loadDocument = function (url) {
  return hydra.httpClient.request('GET', url)
    .then(function (response) {
      return hydra.documentFromResponse(response, url);
    });
};


// export utils
hydra.utils = utils;


// set defaults
hydra.defaults = {};
hydra.defaults.invokeOperation = hydra.httpClient.jsonLdInvoke;
hydra.defaults.validateClass = hydra.simpleValidateClass;
hydra.defaults.model = {};
hydra.defaults.model.createInvoke = hydra.model.createHttpJsonLdInvoke;
hydra.defaults.model.invokeOperation = hydra.httpClient.rawJsonLdInvoke;


module.exports = hydra;

},{"./lib/core":2,"./lib/http-client":3,"./lib/model":4,"./lib/utils":5,"./lib/validation":6}],2:[function(require,module,exports){
var
  utils = require('./utils'),
  _ = utils.require('lodash'),
  jsonldp = utils.require('jsonld').promises();


var hydra = {};


hydra.ns = {
  vocab: 'http://www.w3.org/ns/hydra/core#',
  apiDocumentation: 'http://www.w3.org/ns/hydra/core#apiDocumentation',
  member: 'http://www.w3.org/ns/hydra/core#member'
};


var rdfs = {
  ns: {
    comment: 'http://www.w3.org/2000/01/rdf-schema#comment',
    label: 'http://www.w3.org/2000/01/rdf-schema#label',
    range: 'http://www.w3.org/2000/01/rdf-schema#range'
  }
};


hydra.Api = function (def) {
  var self = this;

  this.iri = utils.iri(def);

  this.init = function () {
    var classFrameDef = {
      '@context': {
        '@vocab': hydra.ns.vocab,
        'label': rdfs.ns.label
      },
      '@type': 'Class'
    };

    var operationFrameDef = {
      '@context': {
        '@vocab': hydra.ns.vocab,
        'label': rdfs.ns.label
      },
      '@type': 'Operation'
    };

    return Promise.all([
      jsonldp.frame(def, classFrameDef)
        .then(function (classDef) {
          self.classDef = classDef;
        }),
      jsonldp.frame(def, operationFrameDef)
        .then(function (operationDef) {
          self.operationDef = operationDef;
        })])
      .then(function () {
        var inits = [];

        self.classes = self.classDef['@graph'].map(function (def) {
          var instance = new hydra.Class(self, def);

          inits.push(instance.init());

          return instance;
        });

        self.findClass = _.find.bind(null, self.classes, 'iri');

        self.operations = self.operationDef['@graph'].map(function (def) {
          var instance = new hydra.Operation(self, def);

          inits.push(instance.init());

          return instance;
        });

        self.findOperation = _.find.bind(null, self.operations, 'iri');

        return Promise.all(inits)
          .then(function () {
            return self;
          });
      });
  };
};


hydra.Document = function (api, def, iri) {
  var self = this;

  this.api = api;
  this.iri = iri || utils.iri(def);

  this.init = function () {
    return Promise.resolve()
      .then(function () {
        def = utils.unwrap(def);

        if (!('@type' in def)) {
          return Promise.reject('type missing');
        }

        self.classes = _.values(def['@type'])
          .filter(function (type) {
            return !!self.api.findClass(type);
          })
          .map(function (type) {
            return new hydra.ClassDocument(self, self.api.findClass(type), def);
          });

        self.properties = self.classes
          .map(function (documentClass) {
            return documentClass.abstract.properties
              .filter(function (abstractProperty) {
                return abstractProperty.iri in def;
              })
              .map(function (abstractProperty) {
                return new hydra.PropertyDocument(self, abstractProperty, def[abstractProperty.iri]);
              });
          })
          .reduce(function (properties, classProperties) {
            return properties.concat(classProperties);
          }, []);

        self.findProperty = _.find.bind(null, self.properties, 'iri');

        self.findOperation = function() {
          if (arguments.length === 1) {
            var method = arguments[0];

            return self.classes
              .map(function (documentClass) {
                return documentClass.findOperation(method);
              })
              .shift();
          } else {
            var iri = arguments[0];
            var method = arguments[1];

            var documentProperty = self.findProperty(iri);

            if (!documentProperty) {
              return undefined;
            }

            return documentProperty.findOperation(method);
          }
        };

        return self;
      });
  };
};


hydra.Class = function (api, def) {
  var self = this;

  this.api = api;
  this.iri = def['@id'];
  this.label = def.label;

  this.init = function () {
    return Promise.resolve().then(function () {
      self.operations = utils.toArray(def.supportedOperation).map(function (operationDef) {
        return self.api.findOperation(operationDef['@id']);
      });

      self.findOperation = _.find.bind(null, self.operations, 'method');

      self.properties = utils.toArray(def.supportedProperty).map(function (propertyDef) {
        return new hydra.Property(self.api, propertyDef);
      });

      self.findProperty = _.find.bind(null, self.properties, 'iri');

      return self;
    });
  };

  this.validate = hydra.defaults.validateClass;
};


hydra.ClassDocument = function (document, abstract, def) {
  this.document = document;
  this.iri = abstract.iri;
  this.abstract = abstract;
  this.label = this.abstract.label;
  this.operations = abstract.operations.map(function (operation) {
    return new hydra.OperationDocument(document, operation);
  });
  this.properties = abstract.properties
    .filter(function (property) {
      return property.iri in def;
    })
    .map(function (property) {
      return new hydra.PropertyDocument(document, property, def[property.iri]);
    });

  this.findOperation = _.find.bind(null, this.operations, 'method');

  this.findProperty = _.find.bind(null, this.properties, 'iri');
};


hydra.Operation = function (api, def) {
  var self = this;

  this.api = api;
  this.iri = def['@id'];
  this.label = def.label;

  this.init = function () {
    return Promise.resolve().then(function () {
      self.method = def.method;
      self.statusCodes = def.statusCodes;
      self.expects = self.api.findClass(def.expects);
      self.returns = self.api.findClass(def.returns);

      return self;
    });
  };
};


hydra.OperationDocument = function (document, abstract, def) {
  this.document = document;
  this.iri = abstract.iri;
  this.abstract = abstract;
  this.link = !!def ? utils.iri(def) : null;
  this.label = this.abstract.label;
  this.method = this.abstract.method;
  this.statusCodes = this.abstract.statusCodes;
  this.expects = this.abstract.expects;
  this.returns = this.abstract.returns;
  this.invoke = hydra.defaults.invokeOperation.bind(this);
};


hydra.Property = function (api, def) {
  var self = this;

  this.api = api;
  this.iri = utils.iri(def.property);
  this.title = def.title;
  this.description = def.description;
  this.label = def.label;
  this.readonly = def.readonly;
  this.writeonly = def.writeonly;
  this.operations = utils.toArray(def.property.supportedOperation)
    .map(function (operationDef) {
      return self.api.findOperation(utils.iri(operationDef));
    });

  this.findOperation = _.find.bind(null, this.operations, 'method');
};


hydra.PropertyDocument = function (document, abstract, def) {
  this.document = document;
  this.iri = abstract.iri;
  this.abstract = abstract;
  this.link = !!def ? utils.iri(def) : null;
  this.label = this.abstract.label;
  this.operations = abstract.operations.map(function (operation) {
    return new hydra.OperationDocument(document, operation, def);
  });

  this.findOperation = _.find.bind(null, this.operations, 'method');
};


hydra.api = function (json, base) {
  if (_.isString(json)) {
    json = JSON.parse(json);
  }

  return jsonldp.expand(json, {base: base})
    .then(function (compact) {
      return (new hydra.Api(compact)).init();
    });
};


hydra.document = function (api, json, base) {
  if (_.isString(json)) {
    json = JSON.parse(json);
  }

  return jsonldp.expand(json, {base: base})
    .then(function (compact) {
      return (new hydra.Document(api, compact, base)).init();
    });
};


module.exports = hydra;
},{"./utils":5}],3:[function(require,module,exports){
var
  hydra = require('./core'),
  utils = require('./utils'),
  jsonld = utils.require('jsonld'),
  jsonldp = utils.require('jsonld').promises();


hydra.httpClient = {};


if (typeof XMLHttpRequest !== 'undefined') {
  /**
   * Converts a string to a UTF-8 encoded string
   * @param string The string to encode
   * @returns {string} The UTF-8 string
   */
  hydra.httpClient.utf8Encode = function (string) {
    string = string.replace(/\r\n/g, '\n');

    var utftext = '';

    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n);

      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }

    return utftext;
  };

  /**
   * Converts a string to a base-64 encoded string
   * @param input The string to encode
   * @returns {string} The base-64 string
   */
  hydra.httpClient.base64Encode = function (input) {
    var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var output = '';
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    input = hydra.httpClient.utf8Encode(input);

    while (i < input.length) {
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);

      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;

      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }

      output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
    }

    return output;
  };

  /**
   * Request implementation using XMLHttpRequest interface
   *
   * @param method HTTP method
   * @param url URL
   * @param headers Header key/value pairs
   * @param content Content
   * @param callback Callback function using with interface: statusCode, headers, content, error
   */
  hydra.httpClient.requestAsync = function (method, url, headers, content, callback, options) {
    options = options || {};

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState === xhr.DONE) {
        var
          headerLines = xhr.getAllResponseHeaders().split('\r\n'),
          resHeaders = {};

        for (var i = 0; i < headerLines.length; i++) {
          var headerLine = headerLines[i].split(': ', 2);
          resHeaders[headerLine[0].toLowerCase()] = headerLine[1];
        }

        callback(xhr.status, resHeaders, xhr.responseText);
      }
    };

    xhr.open(method, url, true);

    for (var header in headers) {
      xhr.setRequestHeader(header, headers[header]);
    }

    if (options.user && options.password) {
      xhr.setRequestHeader("Authorization", "Basic " + hydra.httpClient.base64Encode(options.user + ":" + options.password));
    }

    xhr.send(content);
  };
} else {
  /**
   * Request implementation using the npm request module
   *
   * @param method HTTP method
   * @param url URL
   * @param headers Header key/value pairs
   * @param content Content
   * @param callback Callback function using with interface: statusCode, headers, content, error
   * @param options Additional options like user or password
   */
  hydra.httpClient.requestAsync = function (method, url, headers, content, callback, options) {
    var request = require('request');

    options = options || {};

    var req = {
      method: method,
      url: url,
      headers: headers,
      body: content
    };

    if (options.user && options.password) {
      req.auth = {
        user: options.user,
        password: options.password
      };
    }

    request(req, function (error, res, body) {
      if (error) {
        callback(null, null, null, error);
      } else {
        callback(res.statusCode, res.headers, body);
      }
    });
  };
}

/**
 * Promise request implementation
 *
 * @param method HTTP method
 * @param url URL
 * @param headers Header key/value pairs
 * @param content Content
 * @param options Additional options like user or password
 * @returns {Promise}
 */
hydra.httpClient.request = function (method, url, headers, content, options) {
  return new Promise(function (resolve, reject) {
    hydra.httpClient.requestAsync(method, url, headers, content, function (status, resHeaders, resBody, error) {
      var response = {
        status: status,
        headers: resHeaders,
        body: resBody,
        request: {
          url: url,
          method: method,
          headers: headers,
          body: content
        }
      };

      if (error) {
        reject(error);
      } else if (status >= 400) {
        reject(new Error('status code ' + status + ': ' + resBody));
      } else {
        resolve(response);
      }
    }, options);
  });
};

/**
 * Extracts the Hydra API Documentation value of the Link header field
 *
 * @param headers
 * @param base
 * @returns {Promise}
 */
hydra.httpClient.apiLink = function (headers, base) {
  if (!('link' in headers)) {
    return Promise.resolve(undefined);
  }

  var rels = jsonld.parseLinkHeader(headers.link);

  if (!(hydra.ns.apiDocumentation in rels)) {
    return Promise.resolve(undefined);
  }

  return utils.expandIri(rels[hydra.ns.apiDocumentation].target, base);
};

/**
 * Extracts the value of the Content-Location header field
 *
 * @param headers
 * @param base
 * @returns {*}
 */
hydra.httpClient.contentLocation = function (headers, base) {
  if (!('content-location' in headers)) {
    return Promise.resolve(undefined);
  }

  return utils.expandIri(headers['content-location'], base);
};

/**
 * Calls an operations with the given headers and content
 *
 * @param headers
 * @param content
 * @param options
 * @returns {Promise}
 */
hydra.httpClient.rawInvoke = function (headers, content, options) {
  var self = this;

  var url = self.link || self.document.iri;

  return hydra.httpClient.request(self.method, url, headers, content, options);
};

/**
 * Calls an operations with the JSON-LD content and converts the response body to JSON-LD
 *
 * @param content
 * @param options
 * @returns {Promise}
 */
hydra.httpClient.rawJsonLdInvoke = function (content, options) {
  var self = this;

  var headers = {
    'Accept': 'application/ld+json'
  };

  if (self.method === 'PATCH' || self.method === 'POST' || self.method === 'PUT') {
    headers['Content-Type'] = 'application/ld+json';
  }

  return hydra.httpClient.rawInvoke.bind(self)(headers, JSON.stringify(content), options)
    .then(function (response) {
      if (response.body && response.body.trim() !== '') {
        return jsonldp.expand(JSON.parse(response.body), {base: response.request.url})
          .then(function (expandedBody) {
            response.body = expandedBody;

            return response;
          })
      } else {
        response.body = null;

        return response;
      }
    });
};

/**
 * Calls an operations with the JSON-LD content and returns the response body converted to JSON-LD
 *
 * @param content
 * @param options
 * @returns {Promise}
 */
hydra.httpClient.jsonLdInvoke = function (content, options) {
  var self = this;

  return hydra.httpClient.rawJsonLdInvoke.bind(self)(content, options)
    .then(function (response) {
      return response.body;
    });
};

},{"./core":2,"./utils":5,"request":undefined}],4:[function(require,module,exports){
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

},{"./core":2,"./utils":5}],5:[function(require,module,exports){
var utils = {};


utils.require = function (module) {
  var globalModule = module;

  if (globalModule === 'lodash') {
    globalModule = '_';
  }

  if (typeof window !== 'undefined' && globalModule in window) {
    return window[globalModule];
  }

  return require(module);
};


var
  _ = utils.require('lodash'),
  jsonldp = utils.require('jsonld').promises();


/**
 * Creates a Hydra Collection from a map or array of members
 *
 * @param iri
 * @param members
 * @returns {Collection}
 */
utils.collection = function (iri, members) {
  return {
    '@id': iri,
    '@type': 'http://www.w3.org/ns/hydra/core#Collection',
    'http://www.w3.org/ns/hydra/core#member': _.values(members).map(function (member) {
      return {
        '@id': member['@id'],
        '@type': member['@type']
      };
    })
  };
};

/**
 * Uses the given context to create a short form of the IRI
 *
 * @param iri
 * @param context
 * @returns {Promise}
 */
utils.compactIri = function (iri, context) {
  var dummy = {};

  dummy[iri] = '';

  return jsonldp.compact(dummy, context)
    .then(function (compactDummy) {
      return _.keys(compactDummy).pop();
    });
};

/**
 * Creates a long version of the IRI using the given base
 *
 * @param iri
 * @param base
 * @returns {Promise}
 */
utils.expandIri = function (iri, base) {
  if (!base) {
    return Promise.resolve(iri);
  }

  var dummy = {
    '@context': {
      '@base': base,
      '@vocab': 'http://schema.org/'
    },
    'name': {
      '@id': iri
    }
  };

  return jsonldp.expand(dummy)
    .then(function (expanded) {
      return expanded[0]['http://schema.org/name'][0]['@id'];
    });
};

/**
 * Extracts the IRI of an JSON-LD object
 *
 * @param obj
 * @returns {*}
 */
utils.iri = function (obj) {
  obj = utils.unwrap(obj);

  if (!obj) {
    return undefined;
  }

  if (_.isString(obj)) {
    return obj;
  }

  if (!('@id' in obj)) {
    return undefined;
  }

  return obj['@id'];
};

/**
 * Checks if the given object is a Hydra Collection
 *
 * @param collection
 * @returns {boolean}
 */
utils.isCollection = function (collection) {
  if (_.isObject(collection)) {
    return false;
  }

  if (!collection.member && !(ns.member in collection)) {
    return false;
  }

  return true;
};

/**
 * Converts single objects and Hydra Collections to Arrays and forwards existing Arrays
 *
 * @param obj
 * @returns {Array}
 */
utils.toArray = function (obj) {
  if (!obj) {
    return [];
  }

  if (utils.isCollection(obj)) {
    obj = obj.member;
  }

  if (!_.isArray(obj)) {
    return [obj];
  }

  return obj;
};

/**
 * Extracts the first subject of an JSON-Ld object
 *
 * @param obj
 * @returns {*}
 */
utils.unwrap = function (obj) {
  if (!obj) {
    return undefined;
  }

  if (_.isString(obj)) {
    return obj;
  }

  if ('@graph' in obj) {
    obj = obj['@graph'];
  }

  if (_.isArray(obj)) {
    if (obj.length === 0) {
      return undefined;
    } else {
      obj = obj[0];
    }
  }

  return obj;
};


module.exports = utils;
},{}],6:[function(require,module,exports){
var
  hydra = require('./core'),
  utils = require('./utils'),
  jsonldp = utils.require('jsonld').promises();


hydra.simpleValidateClass = function (object, read, write) {
  var self = this;

  if (!object) {
    return Promise.resolve();
  }

  return jsonldp.expand(object)
    .then(function (expanded) {
      if (expanded.length > 1) {
        return Promise.reject(new Error('object contains multiple subjects'));
      }

      expanded = expanded.shift();

      if (!('@type' in expanded)) {
        return Promise.reject(new Error('@type missing'));
      }

      if (utils.toArray(expanded['@type']).indexOf(self.iri) < 0) {
        return Promise.reject(new Error('expected class <' + self.iri + '>'));
      }

      var error = self.properties
        .map(function (property) {
          if (property.readonly && property.iri in object) {
            return new Error('readonly property <' + property.iri + '> filled with value "' + object[property.iri] + '"');
          }

          return false;
        })
        .filter(function (error) {
          return !!error;
        })
        .shift();

      if (error) {
        return Promise.reject(error);
      }

      return Promise.resolve();
    });
};


},{"./core":2,"./utils":5}]},{},[1])(1)
});