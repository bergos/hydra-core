'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('jsonld'));
  } else {
    root.hydra = factory(root.jsonld);
  }
})(this, function (jsonld) {

  var hydra = {};

  var jsonldp = jsonld.promises();

  var ns = {
    hydra: {
      apiDocumentation: 'http://www.w3.org/ns/hydra/core#apiDocumentation',
      member: 'http://www.w3.org/ns/hydra/core#member'
    },
    rdfs: {
      comment: 'http://www.w3.org/2000/01/rdf-schema#comment',
      label: 'http://www.w3.org/2000/01/rdf-schema#label',
      range: 'http://www.w3.org/2000/01/rdf-schema#range'
    }
  };

  var utils = hydra.utils = {};

  utils.collection = function (iri, members) {
    return {
      '@id': iri,
      '@type': 'http://www.w3.org/ns/hydra/core#Collection',
      'http://www.w3.org/ns/hydra/core#member': utils.values(members).map(function (member) {
        return {
          '@id': member['@id'],
          '@type': member['@type']
        };
      })
    };
  };

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

  utils.finder = function (array, property) {
    property = property || 'iri';

    return function (key) {
      if (property === 'iri') {
        key = utils.iri(key);
      }

      return array
        .filter(function (item) {
          return item[property] === key;
        })
        .shift();
    };
  };

  utils.iri = function (obj) {
    obj = utils.unwrap(obj);

    if (!obj) {
      return undefined;
    }

    if (typeof obj === 'string') {
      return obj;
    }

    if (!('@id' in obj)) {
      return undefined;
    }

    return obj['@id'];
  };

  utils.isCollection = function (collection) {
    if (typeof collection !== 'object') {
      return false;
    }

    if (!collection.member && !(ns.member in collection)) {
      return false;
    }

    return true;
  };

  utils.toArray = function (obj) {
    if (!obj) {
      return [];
    }

    if (hydra.utils.isCollection(obj)) {
      obj = obj.member;
    }

    if (!Array.isArray(obj)) {
      return [obj];
    }

    return obj;
  };

  utils.unwrap = function (obj) {
    if (!obj) {
      return undefined;
    }

    if (typeof obj === 'string') {
      return obj;
    }

    if ('@graph' in obj) {
      obj = obj['@graph'];
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return undefined;
      } else {
        obj = obj[0];
      }
    }

    return obj;
  };

  utils.values = function (array) {
    if (!array) {
      return undefined;
    }

    return Object.keys(array).map(function (key) {
      return array[key];
    });
  };

  if (typeof XMLHttpRequest !== 'undefined') {
    hydra.requestAsync = function (method, requestUrl, headers, content, callback) {
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

      xhr.open(method, requestUrl, true);

      for (var header in headers) {
        xhr.setRequestHeader(header, headers[header]);
      }

      xhr.send(content);
    };
  } else {
    hydra.requestAsync = function (method, requestUrl, headers, content, callback, options) {
      var
        request = require('request');

      options = options || {};

      var reqOptions = {
        method: method,
        url: requestUrl,
        headers: headers,
        body: content
      };

      if (options.user && options.password) {
        reqOptions.auth = {
          user: options.user,
          password: options.password
        };
      }

      request(reqOptions, function (error, response, body) {
        if (error) {
          callback(null, null, null, error);
        } else {
          callback(response.statusCode, response.headers, body);
        }
      });
    };
  }

  hydra.defaults = {};

  hydra.request = function (method, url, reqHeaders, reqBody, options) {
    return new Promise(function (resolve, reject) {
      hydra.requestAsync(method, url, reqHeaders, reqBody, function (status, resHeaders, resBody, error) {
        var response = {
          status: status,
          headers: resHeaders,
          body: resBody
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


  hydra.api = function (json, base) {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }

    return jsonldp.expand(json, {base: base})
      .then(function (compact) {
        return (new hydra.Api(compact)).init();
      });
  };


  hydra.document = function (api, json, base) {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }

    return jsonldp.expand(json, {base: base})
      .then(function (compact) {
        return (new hydra.Document(api, compact, base)).init();
      });
  };

  hydra.load = function (apiDef, documentDef) {
    return hydra.api(apiDef)
      .then(function (api) {
        return hydra.document(api, documentDef);
      });
  };

  hydra.loadUrl = function (url) {
    var documentDef;

    return hydra.request('GET', url)
      .then(function (response) {
        documentDef = response.body;

        if (!('link' in response.headers)) {
          throw 'link header field missing';
        }

        var rels = jsonld.parseLinkHeader(response.headers.link);

        if (!(ns.hydra.apiDocumentation in rels)) {
          throw 'api documentation link missing';
        }

        return utils.expandIri(rels[ns.hydra.apiDocumentation].target, url)
          .then(function (apiUrl) {
            return hydra.request('GET', apiUrl)
              .then(function (response) {
                return hydra.api(response.body, apiUrl);
              })
              .then(function (api) {
                api.url = apiUrl;

                return api;
              });
          });
      })
      .then(function (api) {
        return hydra.document(api, documentDef, url);
      })
      .then(function (document) {
        document.url = url;

        return document;
      });
  };

  hydra.Api = function (def) {
    var self = this;

    this.iri = utils.iri(def);

    this.init = function () {
      var classFrameDef = {
        '@context': {
          '@vocab': 'http://www.w3.org/ns/hydra/core#',
          'label': ns.rdfs.label
        },
        '@type': 'Class'
      };

      var operationFrameDef = {
        '@context': {
          '@vocab': 'http://www.w3.org/ns/hydra/core#',
          'label': ns.rdfs.label
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

          self.findClass = utils.finder(self.classes);

          self.operations = self.operationDef['@graph'].map(function (def) {
            var instance = new hydra.Operation(self, def);

            inits.push(instance.init());

            return instance;
          });

          self.findOperation = utils.finder(self.operations);

          return Promise.all(inits)
            .then(function () {
              return self;
            });
        });
    };
  };

  hydra.Document = function (api, def, base) {
    var self = this;

    this.api = api;
    this.iri = utils.iri(def);
    this.base = base;

    this.init = function () {
      return Promise.resolve()
        .then(function () {
          def = utils.unwrap(def);

          if (!('@type' in def)) {
            return Promise.reject('type missing');
          }

          self.classes = utils.values(def['@type'])
            .filter(function (type) {
              return !!self.api.findClass(type);
            })
            .map(function (type) {
              return new hydra.ClassDocument(self, self.api.findClass(type), def, self.base);
            });

          self.properties = self.classes
            .map(function (documentClass) {
              return documentClass.abstract.properties
                .filter(function (abstractProperty) {
                  return abstractProperty.iri in def;
                })
                .map(function (abstractProperty) {
                  return new hydra.PropertyDocument(self, abstractProperty, def[abstractProperty.iri], self.base);
                });
            })
            .reduce(function (properties, classProperties) {
              return properties.concat(classProperties);
            }, []);

          self.findProperty = utils.finder(self.properties);

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
      return Promise.resolve()
        .then(function () {
          self.operations = utils.toArray(def.supportedOperation).map(function (operationDef) {
            return self.api.findOperation(operationDef['@id']);
          });

          self.findOperation = utils.finder(self.operations, 'method');

          self.properties = utils.toArray(def.supportedProperty).map(function (propertyDef) {
            return new hydra.Property(self.api, propertyDef);
          });

          self.findProperty = utils.finder(self.properties);

          return self;
        });
    };

    this.validate = function (object) {
      return jsonldp.expand(object)
        .then(function (expanded) {
          if (expanded.length > 1) {
            return new Error('object contains multiple subjects');
          }

          expanded = expanded.shift();

          if (!('@type' in expanded)) {
            return new Error('@type missing');
          }

          if (utils.toArray(expanded['@type']).indexOf(self.iri) < 0) {
            return new Error('expected class <' + self.iri + '>');
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
            return error;
          }

          return false;
        });
    };
  };

  hydra.ClassDocument = function (document, abstract, def, base) {
    this.document = document;
    this.iri = abstract.iri;
    this.abstract = abstract;
    this.base = base;
    this.label = this.abstract.label;
    this.operations = abstract.operations.map(function (operation) {
      return new hydra.OperationDocument(document, operation, null, base);
    });
    this.properties = abstract.properties
      .filter(function (property) {
        return property.iri in def;
      })
      .map(function (property) {
        return new hydra.PropertyDocument(document, property,  def[property.iri], base);
      });

    this.findOperation = utils.finder(this.operations, 'method');

    this.findProperty = utils.finder(this.properties);
  };

  hydra.Operation = function (api, def) {
    var self = this;

    this.api = api;
    this.iri = def['@id'];
    this.label = def.label;

    this.init = function () {
      return Promise.resolve()
        .then(function () {
          self.method = def.method;
          self.statusCodes = def.statusCodes;
          self.expects = self.api.findClass(def.expects);
          self.returns = self.api.findClass(def.returns);

          return self;
        });
    };
  };

  hydra.OperationDocument = function (document, abstract, def, base) {
    var self = this;

    this.document = document;
    this.iri = abstract.iri;
    this.abstract = abstract;
    this.link = !!def ? utils.iri(def) : null;
    this.base = base;
    this.label = this.abstract.label;
    this.method = this.abstract.method;
    this.statusCodes = this.abstract.statusCodes;
    this.expects = this.abstract.expects;
    this.returns = this.abstract.returns;

    this.invoke = function (content, options) {
      var validate = Promise.resolve();

      if (self.expects) {
        validate = self.expects.validate(content);
      }

      var url = self.link || self.base;

      var headers = {
        'Accept': 'application/ld+json'
      };

      if (self.method === 'PATCH' || self.method === 'POST' || self.method === 'PUT') {
        headers['Content-Type'] = 'application/ld+json';
      }

      return validate
        .then(function (error) {
          if (error) {
            return Promise.reject(new Error(error));
          }

          return hydra.request(self.method, url, headers, JSON.stringify(content), options);
        })
        .then(function (response) {
          if (response.body && response.body.trim() !== '') {
            return jsonldp.expand(JSON.parse(response.body), {base: url});
          } else {
            return null;
          }
        });
    };
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

    this.findOperation = utils.finder(this.operations, 'method');
  };

  hydra.PropertyDocument = function (document, abstract, def, base) {
    this.document = document;
    this.iri = abstract.iri;
    this.abstract = abstract;
    this.link = !!def ? utils.iri(def) : null;
    this.base = base;
    this.label = this.abstract.label;
    this.operations = abstract.operations.map(function (operation) {
      return new hydra.OperationDocument(document, operation, def, base);
    });

    this.findOperation = utils.finder(this.operations, 'method');
  };

  /*
      object model
   */

  hydra.defaults.model = {};

  /**
   * Creates a invoke function based on a operation document
   * @param operation {hydra.OperationDocument} The operation
   * @returns {Function} The invoke function
   */
  hydra.defaults.model.createInvoke = function (operation) {
    return function (input) {
      var context = {};

      if ('@context' in this) {
        context = this['@context'];
      }

      return operation.invoke(input)
        .then(function (output) {
          return jsonldp.compact(output, context);
        });
    };
  };

  /**
   * Creates a JSON copy of a model object without functions and without properties with the omit attribute
   */
  hydra.defaults.model.toJSON = function () {
    var copyProperties = function (object, root) {
      if (!object) {
        return null;
      }

      // extend @id property to full path
      if ('@id' in object) {
        root = path.join(root || '', object['@id']);
      }

      var copy = Object.keys(object).reduce(function (json, key) {
        var value = object[key];

        // don't add function properties
        if (typeof value === 'function') {
          return json;
        }

        // don't add properties with @omit flag
        if (typeof value === 'object' && '@omit' in value && value['@omit']) {
          return json;
        }

        // use full path
        if (key === '@id') {
          value = root;
        }

        if (typeof value === 'string') {
          // copy string values
          json[key] = value;
        } else {
          // copy sub properties
          json[key] = copyProperties(value, root);
        }

        return json;
      }, {});

      // convert to Array if original object was an Array
      if (Array.isArray(object)) {
        copy = Object.keys(copy).reduce(function (array, key) {
          array.push(copy[key]);

          return array;
        }, []);
      }

      return copy;
    };

    return copyProperties(this);
  };

  /**
   * Creates a model object based on one or more classes
   * @param classes The class or classes the model will be bases on
   * @param properties Properties to merge into the model object
   * @param options Additional options to control the model creation
   * @returns {*}
   */
  hydra.createModel = function (classes, properties, options) {
    var compactPropertyName = function (iri) {
      var dummy = {};

      dummy[iri] = '';

      return jsonldp.compact(dummy, model['@context'])
        .then(function (compactDummy) {
          return Object.keys(compactDummy).pop();
        });
    };

    var processOperations = function (root, operations) {
      operations.forEach(function (operation) {
        var key = '@' + operation.method.toLowerCase();

        if (!(key in root)) {
          root[key] = options.createInvoke(operation).bind(model);
        }
      });
    };

    var processProperties = function (root, properties) {
      return Promise.all(properties.map(function (property) {
        return compactPropertyName(property.iri)

          .then(function (key) {
            if (!(key in root)) {
              root[key] = {};
            }

            processOperations(root[key], property.operations);
          });
      }));
    };

    var processClass = function (apiClass) {
      model['@type'].push(apiClass.iri);

      processOperations(model, apiClass.operations);

      return processProperties(model, apiClass.properties);
    };

    options = options || {};
    options.createInvoke = options.createInvoke || hydra.defaults.model.createInvoke;
    options.toJSON = options.toJSON || hydra.defaults.model.toJSON;

    var model = {};

    Object.keys(properties || {}).forEach(function (key) {
      model[key] = properties[key];
    });

    if (!('@context' in model)) {
      model['@context'] = {};
    }

    model['@type'] = [];
    model.toJSON = options.toJSON;

    return Promise.all(hydra.utils.toArray(classes).map(function (apiClass) {
      return processClass(apiClass);
    })).then(function () {
      return model;
    })
  };

  return hydra;
});
