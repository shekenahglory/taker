(function () {
'use strict';

angular
  .module('store', [])
  .factory('store', storage);

storage.$inject = ['$rootScope', 'config'];

function storage($scope, config) {

  return {
    set: function(key, data) {
      key = this.account() + '.' + key;
      store.session.set(key, data);
      store.set(key, data);
    },

    get: function(key) {
      key = this.account() + '.' + key;
      return store.session.get(key) || store.get(key);
    },

    account: function(account) {
      if (account) {
        store.session.set('account', account);
        store.set('account', account);

      } else {
        return store.session.get('account') ||
          store.get('account');
      }
    },

    // get stored pairs list
    pairs: function () {
      var key = this.account() + '.pairs';
      var stored = store.session.get(key) || store.get(key) || config.pairs;
      var pairs;

      pairs = [];
      stored.forEach(function(pair) {
        var base = pair.base.currency + '.' + (pair.base.issuer || '');
        var counter = pair.counter.currency + '.' + (pair.counter.issuer || '');
        pairs.push({
          base: JSON.parse(JSON.stringify(pair.base)),
          counter: JSON.parse(JSON.stringify(pair.counter)),
          key: base + '.' + counter,
          pinned: true
        });
      });

      return pairs;
    },

    // add a pair to the stored list
    addPair: function(pair) {
      var pairs = this.pairs();
      var base = pair.base.currency + '.' + (pair.base.issuer || '');
      var counter = pair.counter.currency + '.' + (pair.counter.issuer || '');

      pair.key = base + '.' + counter;

      for (var i=0; i<pairs.length; i++) {

        if ((pairs[i].key === base + '.' + counter) ||
            (pairs[i].key === counter + '.' + base)) {
          return false;
        }

        //new, add it
        pairs.push(pair);
        this.set('pairs', pairs);
        return true;
      }
    },

    removePair: function(pair) {
      var pairs = this.pairs();
      var base = pair.base.currency + '.' + (pair.base.issuer || '');
      var counter = pair.counter.currency + '.' + (pair.counter.issuer || '');

      for (var i=0; i<pairs.length; i++) {

        if ((pairs[i].key === base + '.' + counter) ||
            (pairs[i].key === counter + '.' + base)) {

          pairs.splice(i, 1);
          this.set('pairs', pairs);
          return true;
        }
      }

      // not found
      return false;
    }
  }
}

})();
