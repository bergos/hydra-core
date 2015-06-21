global.Promise = require('es6-promise').Promise;

var
  hydra = require('../hydra-core'),
  jsonld = require('jsonld'),
  jsonldp = jsonld.promises();


var ns = {
  context: { '@vocab': 'http://schema.org/' },
  EntryPoint: 'http://schema.org/EntryPoint',
  Event: 'http://schema.org/Event',
  Person: 'http://schema.org/Person',
  event: 'http://schema.org/event',
  invite: 'http://schema.org/invite',
  invitee: 'http://schema.org/invitee'
};


var eventData = {
  '@context': ns.context,
  startDate: '2015-06-16T00:00:00Z',
  name: 'Test Event',
  description: 'This is a test event created by hydra core'
};


var person = {
  '@type': ns.Person,
  '@id': 'https://bergnet.org/people/bergi/card#me'
};



Promise.resolve()
  .then(function () {
    // load the entry point document
    return hydra.loadUrl('http://localhost:8080/')
      .then(function (document) {
        return Promise.all([
          // create a event object based on eventData
          hydra.createModel(document.api.findClass(ns.Event), eventData),
          // create a entry point object
          hydra.createModel(document.classes, {'@context': ns.context})
        ])
          .then(function (result) {
            var event = result[0];
            var entryPoint = result[1];

            // call the post method of property event
            return entryPoint.event['@post'](event);
          });
      });
  })
  .then(function (createdEvent) {
    // load the event
    return hydra.loadUrl(createdEvent['@id'])
      .then(function (eventDocument) {
        // create a event model object
        return hydra.createModel(eventDocument.classes, {'@context': ns.context})
          .then(function (event) {
            // call the patch method of property invite
            return event.invite['@patch'](person);
          });
      });
  })
  .catch(function (error) {
    console.error(error.stack);
  });
