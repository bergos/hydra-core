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
