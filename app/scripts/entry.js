'use strict';

var appDependencies = [
  'ng',
  'ui.router',
  'store',
  'network',
  'pricebook',
  'tradefeed',
  'rippleName'
];

angular
  .module('app', appDependencies)
  .config(appConfig)
  .constant('config', require('../../config.json'));

require('./app.controller');
require('./about.controller');
require('./main.controller');

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
    },
    {
      name: 'about',
      path: 'about'
    }
  ];

  routes.forEach(function(route){
    $stateProvider.state(route.name, {
      url: '/' + route.path,
      views: {
        guest: { templateUrl: 'views/' + route.name + '.html' }
      }
    });
  });

  $urlRouterProvider.otherwise("/404");
  $locationProvider.html5Mode(true);
}
