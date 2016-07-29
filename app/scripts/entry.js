'use strict';

var appDependencies = [
  'ng',
  'ui.router',
  'store',
  'network',
  'chart',
  'pricebook',
  'tradefeed',
  'rippleName'
];

angular
  .module('app', appDependencies)
  .config(appConfig)
  .constant('config', require('../../config.json'));

require('./app.controller');
require('./main.controller');

require('./directives/chart');
require('./directives/pricebook');

require('./services/network');
require('./services/names');
require('./services/store');
require('./services/tradefeed');

appConfig.$inject = ['$stateProvider', '$urlRouterProvider', '$locationProvider'];

function appConfig ($stateProvider, $urlRouterProvider, $locationProvider) {
  var routes = [
    {
      name: 'main',
      path: ''
    }
  ];

  routes.forEach(function(route){
    $stateProvider.state(route.name, {
      url: '/' + route.path,
      views: {
        main: { templateUrl: 'views/' + route.name + '.html' }
      }
    });
  });

  $urlRouterProvider.otherwise("/404");
  $locationProvider.html5Mode(true);
}
