global.Promise = require('es6-promise').Promise;


var
  assert = require('assert'),
  fs = require('fs'),
  hydra = require('../hydra-core');


var promiseDone = function (done) {
  return function () {
    done();
  };
};

var promiseError = function (done) {
  return function (error) {
    done(error.stack);
  };
};


describe('hydra', function () {
  var base = 'http://www.markus-lanthaler.com';
  var apiString;
  var entryPointString;

  before(function () {
    apiString = fs.readFileSync('test/support/api.json').toString();
    entryPointString = fs.readFileSync('test/support/entrypoint.json').toString();
  });

  describe('utils', function () {
    it('finder should find a single item based on iri or given property', function () {
      var items = [
        {iri: '1', prop: 'a'},
        {iri: '2', prop: 'b'}
      ];

      var iriFinder = hydra.utils.finder(items);
      var propertyFinder = hydra.utils.finder(items, 'prop');

      assert.equal(iriFinder('3'), undefined, 'unknown item');
      assert.deepEqual(iriFinder('2'), {iri: '2', prop: 'b'}, 'known item');
      assert.equal(propertyFinder('c'), undefined, 'unknown item');
      assert.deepEqual(propertyFinder('a'), {iri: '1', prop: 'a'}, 'known item');
    });

    it('iri should return the IRI of an JSON-LD object', function () {
      assert.equal(hydra.utils.iri(null), undefined, 'null object');
      assert.equal(hydra.utils.iri({}), undefined, 'initial object');
      assert.equal(hydra.utils.iri({'@id': 'a'}), 'a', 'filled object');
    });

    it('toArray should convert anything to an array', function () {
      assert.deepEqual(hydra.utils.toArray(null), [], 'null');
      assert.deepEqual(hydra.utils.toArray('1'), ['1'], 'non array value');
      assert.deepEqual(hydra.utils.toArray(['1', '2']), ['1', '2'], 'array value');
    });

    it('unwrap should extract the graph of a JSON-LD object', function () {
      assert.equal(hydra.utils.unwrap(null), undefined, 'null');
      assert.equal(hydra.utils.unwrap('_:test'), '_:test', 'string');
      assert.deepEqual(hydra.utils.unwrap({'@id': 'test'}), {'@id': 'test'}, 'not wrapped graph');
      assert.deepEqual(hydra.utils.unwrap({'@graph': [{'@id': 'test1'}, {'@id': 'test2'}]}), {'@id': 'test1'}, 'wrapped graph');
      assert.deepEqual(hydra.utils.unwrap({'@graph': []}), undefined, 'empty graph');
    });

    it('values should return the values of an object', function () {
      assert.equal(hydra.utils.values(null), undefined, 'null object');
      assert.deepEqual(hydra.utils.values({}), [], 'initial object');
      assert.deepEqual(hydra.utils.values({a: 'ab', b: 'cd'}), ['ab', 'cd'], 'filled object with two properties');
    });
  });

  describe('Api', function () {
    it('should create a hydra.Api object from a JSON string', function (done) {
      hydra.api(apiString, base)
        .then(function (api) {
          assert(api instanceof hydra.Api);
          assert.equal(api.iri, base + '/hydra/api-demo/vocab');
        })
        .then(promiseDone(done))
        .catch(promiseError(done));
    });

    it('should create a hydra.Api object with classes and operations properties', function (done) {
      hydra.api(apiString, base)
        .then(function (api) {
          assert(Array.isArray(api.classes));
          assert.equal(api.classes.length, 6);
          assert(Array.isArray(api.operations));
          assert.equal(api.operations.length, 23);
        })
        .then(promiseDone(done))
        .catch(promiseError(done));
    });
  });

  describe('Document', function () {
    it('should create a hydra.Document object from a JSON string', function (done) {
      hydra.api(apiString)
        .then(function (api) {
          return hydra.document(api, entryPointString, base);
        })
        .then(function (document) {
          assert(document instanceof hydra.Document);
          assert.equal(document.iri, base + '/hydra/api-demo/');
        })
        .then(promiseDone(done))
        .catch(promiseError(done));
    });

    it('should create a hydra.Document object with classes and properties properties', function (done) {
      hydra.api(apiString)
        .then(function (api) {
          return hydra.document(api, entryPointString, base);
        })
        .then(function (document) {
          assert(Array.isArray(document.classes));
          assert.equal(document.classes.length, 1);
          assert(Array.isArray(document.properties));
          assert.equal(document.properties.length, 3);
        })
        .then(promiseDone(done))
        .catch(promiseError(done));
    });
  });
});