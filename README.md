# Hydra Core

Hydra Core provides basic objects to work with Hydra enabled Web APIs.

## Usage

### Node.js

hydra-core is available on `npm`, to install it run:

    npm install hydra-core

In the code, import hydra-core:

    var hydra = require('hydra-core');

## Examples

The examples folder contains working example code for the Hydra Issue Tracker Demo application. 

    cd examples
    node api-demo.js 

An alternative example code uses the object model to access the Hydra Issue Tracker Demo application.

    cd examples
    node api-demo-model.js

## API

### hydra.Api

#### classes:
 `Array` of `hydra.Class` objects defined in the API documentation.

#### operations:
 `Array` of `hydra.Operation` objects defined in the API documentation.

#### findClass(iri):
 Returns a `hydra.Class` object for the given IRI or `undefined` if the IRI is unknown.

#### findOperation(iri):
 Returns a `hydra.Operation` object for the given IRI or `undefined` if the IRI is unknown.

### hydra.Document

#### classes
 `Array` of `hydra.ClassDocument` objects based on `rdf:type` triples in the document.

#### properties
 `Array` of `hydra.PropertyDocument` objects based on triples in the document.

#### findOperation([propertyIri], method):
 Returns a `hydra.OperationDocument` object or `undefined` if the operation was not found.
 Searches only in the classes of the document, if only the `method` argument is given.
 Searches for operations assigned to the property, if the `propertyIri` arguments is also given.  

#### findProperty
 Returns a `hydra.PropertyDocument` object for the given IRI or `undefined` if the IRI is unknown.

### hydra.Class

### hydra.ClassDocument

### hydra.Operation

### hydra.OperationDocument

### hydra.Property

### hydra.PropertyDocument

### hydra.api(json, base)

Parses the given JSON-LD object or string and returns a `hydra.Api` object using a Promise.
The `base` parameter is used to expand the given JSON-LD object. 

### hydra.document(api, json, base)

Parses the given JSON-LD object or string and returns a `hydra.Document` object using a Promise.
`api` must be an instance of `hydra.Api`.
The `base` parameter is used to expand the given JSON-LD object.

## API Model

### hydra.model.create(classes, properties, options)

Creates a model object bases on a single or an `Array` of `hydra.Class` or `hydra.ClassDocument`.
The properties object is merged into the model object.
Additional options that control the model object building.

### hydra.model.hide(property)

Adds a `@omit: true` key value pair to the property object and returns that property object.
`property` must be an object.

### hydra.model.load(url, properties, options)

Creates a model object based on the result of a `GET` request to the given `url`.
The `properties` and `options` arguments will be forwarded to the `hydra.model.create` function.

### hydra.model.toJSON()

A `toJSON` function that removes all functions and properties that contain a `@omit: true` key value pair.