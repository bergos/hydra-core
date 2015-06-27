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

The hydra core object model uses JSON-LD objects extended with functions and additional `@` properties.
Hydra operations are mapped into the objects with the `@` + lower case the HTTP method keys.
For example, if an entry point class contains `http://schema.org/blogPost` property that implements a HTTP POST
method to create a new blog post, the following code could be used:  

    // load the entry point from http://example.com/
    hydra.model.load('http://example.com/')
      .then(function (entryPoint) {

        // create a new blog post using the post method of http://schema.org/blogPost
        return entryPoint['http://schema.org/blogPost']['@post']({
          'http://schema.org/name': 'blog post name',
          'http://schema.org/articleBody': 'this is the content of the blog post'
        });
      })
      .then(function (blogPost) {

        // write the IRI of the created blog post to the console
        console.log(blogPost['@id']);
      });

If a JSON-LD context is defined, the objects will be compacted using that context:
    
    // define the context in the properties object, that will be merged into the model object 
    hydra.model.load('http://example.com/', {'@context': {'@vocab': 'http://schema.org'}})
          .then(function (entryPoint) {
    
            // works also with the POST operation
            return entryPoint.blogPost['@post']({
              '@context': {'@vocab': 'http://schema.org'},
              name: 'blog post name',
              articleBody: 'this is the content of the blog post'
            }, {'@context': {'@vocab': 'http://schema.org'}});
          });

It's possible to add properties to the model object and hide them from the serialization.
A `@omit: true` key value pair must be added to the property.
The `hydra.model.hide` method can be used for this:

    // assign a new hidden variable
    blogPost.privateVariable = hydra.model.hide(privateVariable);

The model object contain a hidden variable `api` that contains the API documentation.
That object can be used to create model objects based on classes defined in the API documentation:

    hydra.model.create(entryPoint.api.findClass('http://schema.org/BlogPost'))
      .then(function (blogPost) {
        
      });

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