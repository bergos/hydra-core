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
