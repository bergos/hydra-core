var
  _ = require('lodash'),
  jsonld = require('jsonld'),
  jsonldp = jsonld.promises(),
  utils = require('./utils');


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