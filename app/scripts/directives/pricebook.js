angular
.module('pricebook', [])
.directive('pricebook', function($window) {
  var reloadTimer;

  function prepareTable (div, base, counter) {
    div.html('');

    var bidsTable = div.append("table").attr("class","bidsTable");
    var bidsHead  = bidsTable.append("thead");
    var bidsBody  = bidsTable.append("tbody");

    bidsHead.append("tr")
    .attr("class","headerRow")
    .selectAll("th")
    .data(["Total","Size","Bid Price"])
    .enter().append("th")
    .text(function(d) {return d;})
    .append("span");

    var asksTable = div.append("table").attr("class","asksTable");
    var asksHead  = asksTable.append("thead");
    var asksBody  = asksTable.append("tbody");

    asksHead.append("tr")
    .attr("class","headerRow")
    .selectAll("th")
    .data(["Ask Price","Size","Total"])
    .enter().append("th")
    .text(function(d) {return d;})
    .append("span");

    if (base && counter) {
      bidsHead.select(".headerRow th:nth-child(1) span").html(base.currency);
      bidsHead.select(".headerRow th:nth-child(2) span").html(base.currency);
      bidsHead.select(".headerRow th:nth-child(3) span").html(counter.currency);

      asksHead.select(".headerRow th:nth-child(1) span").html(counter.currency);
      asksHead.select(".headerRow th:nth-child(2) span").html(base.currency);
      asksHead.select(".headerRow th:nth-child(3) span").html(base.currency);
    }
  }

  function reloadBook(div, pricebook) {

    clearTimeout(reloadTimer);

    reloadTimer = setTimeout(reloadHelper, 250);

    function reloadHelper() {

      var bids;
      var bidsEnter;
      var asks;
      var asksEnter;

      bids = div.select('table.bidsTable tbody')
      .selectAll('tr')
      .data(extractData('bids'), function(d) {return d.price});

      bidsEnter = bids.enter().append("tr");
      bidsEnter.append('td').attr('class','sum');
      bidsEnter.append('td').attr('class','size');
      bidsEnter.append('td').attr('class','price');

      bids.select('.sum').html(function(d){return formatAmount(d.sum)});
      bids.select('.size').html(function(d){return formatAmount(d.size)});
      bids.select('.price').html(function(d){return formatAmount(d.price)});

      bids.classed('more', function(d) {
        return d.change && d.change > 0
      });

      bids.classed('less', function(d) {
        return d.change && d.change < 0
      });

      bids.classed('new', function(d) {
        return d.added;
      });

      bids.order();

      bids.attr('id', function(d) {
        return 'bid-' + d.price;
      });

      bids.exit()
      .attr('class', 'remove')
      .transition()
      .delay(800)
      .remove();

      asks = div.select('table.asksTable tbody')
      .selectAll('tr')
      .data(extractData('asks'), function(d) {return d.price});

      asksEnter = asks.enter().append("tr");
      asksEnter.append('td').attr('class','price');
      asksEnter.append('td').attr('class','size');
      asksEnter.append('td').attr('class','sum');

      asks.select('.sum').html(function(d){return formatAmount(d.sum)});
      asks.select('.size').html(function(d){return formatAmount(d.size)});
      asks.select('.price').html(function(d){return formatAmount(d.price)});

      asks.classed('more', function(d) {
        return d.change && d.change > 0
      });

      asks.classed('less', function(d) {
        return d.change && d.change < 0
      });

      asks.classed('new', function(d) {
        return d.added;
      });

      asks.order();
      asks.attr('id', function(d) {
        return 'ask-' + d.price;
      });

      asks.exit()
      .attr('class', 'remove')
      .transition()
      .delay(800)
      .remove();
    }

    function formatAmount (amount) {
      if (!amount) {
        return '&nbsp';
      }

      parts = amount.split(".");
      parts[0] = Number(parts[0]).toLocaleString();

      if (parts[1]) {
        parts[1] = parts[1].replace(/0(0+)$/, '0<span class="insig">$1</span>');
        parts[1] = '<span class="decimal">.' + parts[1] + '</span>';
      }

      return parts[1] ? parts[0] + parts[1] : parts[0];
    }

    function extractData(type) {
      var length = 30;
      var offers = pricebook[type].slice(0, length);
      var data = [];
      var sum = 0;
      var best = Number(offers[0].price);
      var precision = Math.round(Math.log10(best)) + 1;
      var size;
      var i;

      // not less than 0
      if (precision<0) {
        precision = 0;
      }

      for (i=0; i<offers.length; i++) {
        size = Number(offers[i].size);
        sum += size;

        offers[i] = {
          price: offers[i].price,
          size: size.toFixed(precision),
          sum: sum.toFixed(precision),
          change: offers[i].change,
          added: offers[i].added
        }
      }

      return pad(offers, length);
    }

    function pad(data, length) {
      length -= data.length;
      if (length<1) return data;

      var newArray = [];
      for (var i=0; i<length; i++) {newArray[i] = {};}
      return data.concat(newArray);
    }
  }

  function updateBook(div, pricebook, delta) {
    var type;
    var length;
    var row;
    var data;
    var key;

    if (!pricebook) {
      return;
    }

    for (var type in delta) {
      if (!pricebook[type]) {
        continue;
      }

      length = pricebook[type].length;

      while(length--) {
        row = pricebook[type][length];
        if (!row.price) {
          console.log (row);
          continue;
        }

        delete row.change;
        delete row.added;

        key = row.price.toString();
        data = delta[type][key];

        // updated
        if (data && data.update) {
          row.change = Number(data.size) - Number(row.size);
          row.size = data.size;
          delete delta[type][key];

        // removed
        } else if (data && data.remove) {
          pricebook[type].splice(length, 1);
          delete delta[type][key];
        }
      }

      // added
      for (var key in delta[type]) {
        pricebook[type].push({
          price: delta[type][key].price,
          size: delta[type][key].size,
          added: true
        });
      }

      // sort by price
      pricebook[type].sort(function(a,b) {
        if (type === 'asks') {
          return Number(a.price) - Number(b.price);
        } else {
          return Number(b.price) - Number(a.price);
        }
      });
    }

    reloadBook(div, pricebook);
  }

  var PricebookClient = function(options) {
    var self = this;
    var queue = [];
    var ws;
    var uri = options.secure ? 'wss://' : 'ws://' +
      options.host + (options.port ? ':' + options.port : '');

    var base;
    var counter;

    self._connected = false;
    self.onPricebook = function() {};
    self.onDelta = function() {};
    self._retry = 0;
    self._shouldConnect;

    // connect
    self.connect = function() {
      self._shouldConnect = true;

      if (self._ws) {
        self._ws.onmessage = null;
        self._ws.onclose = null;
        self._ws.close();
        delete self._ws;
      }

      self._ws = new WebSocket(uri);

      self._ws.onopen = function() {
        var message;

        console.log('pricebook client connected');
        self._connected = true;
        self._retry = 0;

        if (base && counter) {
          resubscribe();
        }

        while (message = queue.pop()) {
          send(message);
        }
      }

      // incoming message
      self._ws.onmessage = function(message) {
        var event;

        message = JSON.parse(message.data);
        if (!message.base || !message.counter) {
          console.log(message);

        } else if (!base || !counter) {
          console.log('unsubscribed', message.base, message.counter);

        } else if (message.base.currency != base.currency ||
                   message.base.issuer != base.issuer ||
                   message.counter.currency != counter.currency ||
                   message.counter.issuer != counter.issuer) {
          console.log('no longer subscribed', message.base, message.counter);

        } else if (message.pricebook) {
          self.onPricebook(message.pricebook);

        } else if (message.delta) {
          self.onDelta(message.delta);

        } else {
          console.log(message);
        }
      };

      // connection closed
      self._ws.onclose = function() {
        self._connected = false;
        if (self._shouldConnect) {
          retryConnect();
        }
      }
    }

    // disconnect
    self.disconnect = function() {
      self.shouldConnect = false;
      self._retry = 0;

      if (self._ws) {
        self._ws.close();
      }
    };

    self.subscribe = function (pair) {
      if (base && counter) {
        var message = {
          method: 'unsubscribe',
          params: {
            base: base,
            counter: counter
          }
        };

        send(message);
      }

      base = pair.base;
      counter = pair.counter;
      resubscribe();
    };


    function resubscribe() {
      var message = {
        method: 'subscribe',
        params: {
          base: base,
          counter: counter
        }
      };

      send(message);
    }

    function retryConnect() {

      self._retry++;

      var retryTimeout = (self._retry < 40)
        // First, for 2 seconds: 20 times per second
        ? (1000 / 20)
        : (self._retry < 40 + 60)
          // Then, for 1 minute: once per second
          ? (1000)
          : (self._retry < 40 + 60 + 60)
            // Then, for 10 minutes: once every 10 seconds
            ? (10 * 1000)
            // Then: once every 30 seconds
            : (30 * 1000);

      function connectionRetry() {
        if (self._shouldConnect) {
          self.connect();
        }
      }

       console.log('pricebook connection retry:', self, retryTimeout);
      self._retryTimer = setTimeout(connectionRetry, retryTimeout);
    };

    function send (message) {
      if (!self._connected) {
        queue.push(message);
        return;
      }

      try {
        self._ws.send(JSON.stringify(message));
      } catch (e) {
        console.log(e);
      }
    }
  }

  return {
    restrict: 'AE',
    link: function(scope, element) {
      var div = d3.select(element[0]);
      var client = new PricebookClient({
        host: 'localhost',
        port: 7171
      });
      var base;
      var counter;
      var pricebook;

      client.connect();

      // force reconnect when coming online
      window.addEventListener("online", function() {
        console.log('online');
        client._retry = 0;
        client.connect();
      });

      element.addClass('orderbook');

      scope.$watch('bookOptions', function() {

        if (base && counter) {
          pricebook = {};
        }

        base = scope.bookOptions ? scope.bookOptions.base : undefined;
        counter = scope.bookOptions ? scope.bookOptions.counter : undefined;

        prepareTable(div, base, counter);

        if (base && counter) {
          client.subscribe({
            base: base,
            counter: counter
          });
        }
      });

      client.onPricebook = function(book) {
        console.log(book);
        pricebook = book;
        reloadBook(div, pricebook);
      };

      client.onDelta = function(delta) {
        console.log('delta');
        updateBook(div, pricebook, delta);
      };
    }
  }
});
