'use strict';

angular
  .module('app')
  .controller('MainController', MainController);

MainController.$inject = [
  '$scope',
  '$http',
  '$sce',
  'store',
  'tradefeed',
  'rippleName'
];

function MainController ($scope, $http, $sce, store, tradefeed, rippleName)
{
  var API = 'https://data.ripple.com/v2/';
  var order = [
    'XAU',
    'XAG',
    'BTC',
    'XRP',
    'EUR',
    'GBP',
    'AUD',
    'NZD',
    'USD',
    'CAD',
    'CHF',
    'JPY'
  ];

  var feed = tradefeed.create({}, function(ex) {
    checkPrices(ex);
  });

  /*
  var chart = PriceChartWidget({
    id: "chart",
    margin: {top:20, bottom:40, left:60, right:60},
    resize: true
  });
  */

  $scope.pairs = store.pairs();
  $scope.current = {
    index: null,
    chartURL: null
  };

  $scope.$watch('current.index', function() {
    if ($scope.current.index !== null) {
      loadPair($scope.current.index);
    } else {
      $scope.current.chartURL = null;
      if ($scope.book) {
        $scope.book.unsubscribe();
      }
    }
  });

  // ensure order first
  $scope.pairs.forEach(function(pair) {
    orderPair(pair);
    addNames(pair);
  });

  // get last price
  $scope.pairs.forEach(function(p) {
    var url = API + 'exchanges/' + p.base.currency +
    (p.base.issuer ? '+' + p.base.issuer : '') + '/' +
    p.counter.currency +
    (p.counter.issuer ? '+' + p.counter.issuer : '') + '?descending=true&limit=1';

    p.last = '0.0';

    $http.get(url).success(function(resp) {
      p.price = resp.exchanges[0].rate;
      p.last = formatNumber(p.price, 7);
    }).error(function(err) {
      p.last = 'N/A';
    });
  });

  $scope.togglePin = function (pair) {
    if (pair.pinned) {
      store.removePair(pair);
      pair.pinned = false;
    } else {
      store.addPair(pair);
      pair.pinned = true;
    }
  };

  function orderPair(pair) {
    var base = order.indexOf(pair.base.currency);
    var counter = order.indexOf(pair.counter.currency);
    var swap;
    var parts;

    // neither present
    if (base === -1 && counter === -1) {
      swap = pair.base.currency - pair.counter.currency < 0 ? true : false;

    // counter not present
    } else if (base === -1) {
      swap = true;

    } else if (counter === -1) {
      swap = false;

    // both present, base < counter
    } else if (base < counter) {
      swap = false;

    // both present base > counter
    } else if (base > counter) {
      swap = true;
    }

    if (swap) {
      swap = pair.base;
      pair.base = pair.counter;
      pair.counter = swap;
      parts = pair.key.split('.');
      pair.key = parts[2] + '.' +
        parts[3] + '.' +
        parts[0] + '.' +
        parts[1];
    }
  }

  function addNames(pair) {
    [pair.base, pair.counter].forEach(function(currency) {
      if (currency.issuer) {
        currency.label = currency.issuer;
        rippleName(currency.issuer, function(name) {
          if (name) currency.label = name;
        });
      }
    });
  }

  function loadPair(index) {
    console.log(index);
    var pair = $scope.pairs[index];

    if ($scope.book) {
      $scope.book.unsubscribe();
    }

    /*
    chart.load({
      base: pair.base,
      counter: pair.counter,
      interval: 'hour',
      theme: 'dark'
    });
    */

    var url = 'https://www.ripplecharts.com/embed/pricechart?' +
        'theme=dark&interval=hour&type=candlestick' +
        '&base=' + JSON.stringify(pair.base) +
        '&counter=' + JSON.stringify(pair.counter);

    $scope.current.chartURL = $sce.trustAsResourceUrl(url);
    $scope.current.base = pair.base.label != pair.base.issuer ? pair.base.label : '';
    $scope.current.counter = pair.counter.label != pair.counter.issuer ? pair.counter.label : '';
    $scope.current.pair = pair;
    $scope.bookOptions = {
      base: pair.base,
      counter: pair.counter
    };
  }

  function checkPrices(ex) {
      var base = ex.base.currency + '.' + (ex.base.issuer || '');
      var counter = ex.counter.currency + '.' + (ex.counter.issuer || '');
    var newPairs = {};
    var key;
    var rate;
    var pair;
    var pBase;
    var pCounter;

    console.log(base, counter, ex.rate, 'pairs: ' + $scope.pairs.length);
    for (var i=0; i<$scope.pairs.length; i++) {
      var pair = $scope.pairs[i];

      if (pair.key === base + '.' + counter) {
        updatePrice(pair, ex.rate);
        return;

      } else if (pair.key === counter + '.' + base) {
        ex = feed.invertExchange(ex);
        updatePrice(pair, ex.rate);
        return;
      }
    }

    // add to the list
    if ($scope.pairs.length < 200) {
      pair = {
        base: {currency: ex.base.currency, issuer: ex.base.issuer},
        counter: {currency: ex.counter.currency, issuer: ex.counter.issuer},
        key: base + '.' + counter
      };

      orderPair(pair);
      if (pair.base.currency !== ex.base.currency) {
        ex = feed.invertExchange(ex);
      }

      pair.price = ex.rate;
      pair.last = formatNumber(ex.rate, 7);
      $scope.pairs.push(pair);
      addNames(pair);
      $scope.$apply();
    }
  }

  function updatePrice (pair, price) {
    if (price > pair.price) {
      pair.direction = 'up';
    } else if (price < pair.price) {
      pair.direction = 'down';
    } else {
      pair.direction = 'unch';
    }

    pair.price = price;
    pair.last = formatNumber(price, 7);

    $scope.$apply();
  }
}

function formatNumber(x, digits) {
  var parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (parts[1] && digits) {
    var max = digits - parts[0].length;
    if (max < 1) {
      parts[1] = '';
    } else {
      if (max < 2) max = 2;
      parts[1] = parts[1].slice(0, max);
    }
  }

  return parts[1] ? parts.join(".") : parts[0];
}
