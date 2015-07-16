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
  if (!_.isObject(collection)) {
    return false;
  }

  if (!collection.member && !('http://www.w3.org/ns/hydra/core#member' in collection)) {
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