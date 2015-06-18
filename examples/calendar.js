global.Promise = require('es6-promise').Promise;

var
  hydra = require('../hydra-core'),
  jsonld = require('jsonld'),
  jsonldp = jsonld.promises();


var ns = {
  context: { '@vocab': 'http://schema.org/' },
  EntryPoint: 'http://schema.org/EntryPoint',
  Event: 'http://schema.org/Event',
  event: 'http://schema.org/event',
  invite: 'http://schema.org/invite',
  invitee: 'http://schema.org/invitee'
};


var event = {
  '@context': ns.context,
  '@type': ns.Event,
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
    // load the entry point
    return hydra.loadUrl('http://localhost:8080/')
      .then(function (document) {
        // search for the create event operation...
        var createEvent = document.findOperation(ns.event, 'POST');

        if (!createEvent) {
          throw new Error('API doesn\'n have a create event operation');
        }

        // ...and call it
        return createEvent.invoke(event)
          .then(function (createdEvent) {
            // compact the JSON-LD output
            return jsonldp.compact(createdEvent, ns.context);
          });
      });
  })
  .then(function (createdEvent) {
    // load the event
    return hydra.loadUrl(createdEvent['@id'])
      .then(function (eventDocument) {
        // search for the invite operation...
        var invite = eventDocument.findOperation(ns.invite, 'PATCH');

        if (!invite) {
          throw new Error('API doesn\'n have an invite operation');
        }

        // ..and call it
        invite.invoke(person);
      });
  })
  .catch(function (error) {
    console.error(error.stack);
  });
