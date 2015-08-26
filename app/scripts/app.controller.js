'use strict';

angular
  .module('app')
  .controller('AppController', AppController);

AppController.$inject = ['$rootScope', 'rpNetwork'];

function AppController ($scope, network)
{
  network.init();
}
