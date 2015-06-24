global.Promise = require('es6-promise').Promise;

var
  hydra = require('../');


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


// create a entry point object
hydra.model.load('http://localhost:8080/', {'@context': ns.context})
  .then(function (entryPoint) {
    console.log('loaded entry point: <' + entryPoint.document.iri + '>');

    // create a event object based on eventData
    return hydra.model.create(entryPoint.api.findClass(ns.Event), eventData)
      .then(function (event) {
        console.log('created event from abstract class with name: ' + event.name);

        // call the post method of property event
        return entryPoint.event['@post'](event);
      });
  })
  .then(function (event) {
    console.log('added event to calendar: <' + event['@id'] + '>');

    // call the patch method of property invite
    return event.invite['@patch'](person);
  })
  .then(function () {
    // no content in response -> Promise.resolve === success

    console.log('invited: <' + person['@id'] + '>');
  })
  .catch(function (error) {
    console.error(error.stack);
  });
