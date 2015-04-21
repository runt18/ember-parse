import Ember from 'ember';

export default Ember.Service.extend({
  init() {
    var key = this.get('sessionStoreKey'),
        store = this.container.lookup('store:main'),
        model = store.modelFor('user'),
        adapter = store.adapterFor('application'),
        serializer = store.serializerFor(model);

    this.sessionStore.get(key).then((sessionData) => {
      if (sessionData && sessionData.userId &&
          sessionData.sessionToken && sessionData._response) {

        this.setProperties({
          userId: sessionData.userId,
          sessionToken: sessionData.sessionToken
        });

        // Create a user instance and push to store
        serializer.normalize(model, sessionData._response);
        store.push(model, sessionData._response);

        // Set adapter properties
        delete sessionData._response;
        adapter.setProperties(sessionData);
      }
    });
  },

  userId: null,
  sessionToken: null,
  sessionStoreKey: 'ember-parse:session',
  isAuthenticated: Ember.computed('userId', 'sessionToken', function() {
    if (Ember.isEmpty(this.get('userId')) || Ember.isEmpty(this.get('sessionToken'))) {
      return false;
    } else {
      return true;
    }
  }),

  authenticate(username, password) {
    var key = this.get('sessionStoreKey'),
        store = this.container.lookup('store:main'),
        model = store.modelFor('user'),
        adapter = store.adapterFor('application'),
        serializer = store.serializerFor(model);

      var data = {
        username: username,
        password: password,
        _method: 'GET'
      };

      return adapter.ajax(adapter.buildURL('login'), 'POST', {data: data})
        .then((response) => {
          var sessionData = {
            userId: response.objectId,
            sessionToken: response.sessionToken,
            _response: response
          };

          this.setProperties(sessionData);
          this.sessionStore.save(key, sessionData);

          // Set adapter properties
          delete sessionData._response;
          adapter.setProperties(sessionData);

          serializer.normalize(model, response);
          var record = store.push(model, response);

          return record;

        }, (reason) => {
          var err = `Code ${reason.responseJSON.code}: ${reason.responseJSON.error}`;
          return Ember.RSVP.reject(new Error(err));
        });
  },

  invalidate() {
    if (this.get('isAuthenticated')) {
      var key = this.get('sessionStoreKey'),
          store = this.container.lookup('store:main'),
          adapter = store.adapterFor('application');

      // Manually remove user from store
      store.find('user', this.get('userId')).then((user) => {
        user.unloadRecord();
      });

      var sessionData = {
        userId: null,
        sessionToken: null
      };

      this.setProperties(sessionData);
      adapter.setProperties(sessionData);

      return this.sessionStore.destroy(key);
    } else {
      return Ember.RSVP.resolve();
    }
  },

  sessionStore: {
    save(key, data) {
      return new Ember.RSVP.Promise(function(resolve) {
        resolve(localStorage.setItem(key, JSON.stringify(data)));
      });
    },

    get(key) {
      return new Ember.RSVP.Promise(function(resolve) {
        resolve(JSON.parse(localStorage.getItem(key)));
      });
    },

    destroy(key) {
      return new Ember.RSVP.Promise(function(resolve) {
        resolve(localStorage.removeItem(key));
      });
    }
  }
});
