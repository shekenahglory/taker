(function () {
'use strict';

angular
  .module('rippleName', [])
  .factory('rippleName', rippleName);

rippleName.$inject = ['$rootScope', '$http'];

function rippleName($scope, $http) {
  var names = { };
  var getName = function (address, callback) {

    if (names[address] && names[address] === '#pending') {

      setTimeout(function() {
        getName(address, callback);
      }, 100);


    } else if (names[address] && names[address] === '#unknown') {
      callback();

    } else if (names[address]) {
      callback(names[address]);

    } else {
      names[address] = '#pending';
      $http.get('https://id.ripple.com/v1/user/'+address)
      .success(function(resp) {
        if (resp.username) {
          names[address] = resp.username;
          callback(names[address]);
        } else {
          names[address] = '#unknown';
          callback();
        }
      }).error(function(err) {
        names[address] = '#unknown';
        callback();
      });
    }
  }

  return getName;
}
}());
