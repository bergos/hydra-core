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

