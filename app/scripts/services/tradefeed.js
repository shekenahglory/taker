'use strict';

var module = angular.module('tradefeed', ['network']);
var Amount = ripple.Amount;
var XRP_ADJUST = 1000000.0;

module.factory('tradefeed', ['rpNetwork', '$rootScope',
function(net, $scope, id) {
  return {
    create : function(options, emit) {
      options.remote = net.remote;
      return new TradeFeed(options, emit);
    }
  }
}]);

function TradeFeed(options, emit) {

  this.emit = emit;
  this.remote = options.remote;
  this.parser;
  this.bucket;
  this.interval;
  this.timeout;
  this.check;

  /**
   * finishInterval
   */

  this.finishedInterval = function() {

    //emit results
    this.emit(formatReduceResult(this.bucket), true);

    //reset the stored results
    var startTime = moment.utc(this.bucket.startTime)
      .add(this.options.multiple, this.options.interval);
    this.resetBucket({startTime:startTime});
  };

  //start feed
  this.listen(options);
}

TradeFeed.prototype.resetBucket = function(bucket) {
  this.bucket = {
    startTime: moment.utc(bucket.startTime).format(),
    curr1Volume: bucket.baseVolume || 0.0,
    curr2Volume: bucket.counterVolume || 0.0,
    numTrades: bucket.count || 0,
    open: bucket.open || 0.0,
    high: bucket.high || 0.0,
    low: bucket.low || 0.0,
    close: bucket.close || 0.0,
    vwap: bucket.vwap || 0.0,
    openTime: bucket.openTime || 0,
    closeTime: bucket.closeTime || 0
  };
};

/**
 *  stop
 */

TradeFeed.prototype.stop = function() {

  this.bucket = {};

  if (this.interval) {
    clearInterval(this.interval);
  }
  if (this.timeout)  {
    clearTimeout(this.timeout);
  }
  if (this.check)    {
    clearInterval(this.check);
  }
  if (this.parser) {
    this.remote.removeListener('transaction_all', this.parser);
  }
};

/**
 * invertExchange
 */

TradeFeed.prototype.invertExchange = function(offer) {
  var swap;

  swap          = offer.base;
  offer.base    = offer.counter;
  offer.counter = swap;
  offer.rate    = new BigNumber(offer.rate).pow(-1).toString();
  swap          = offer.buyer;
  offer.buyer   = offer.seller;
  offer.seller  = swap;

  return offer;
};

/**
 * listen
 * start listening for trades
 */

TradeFeed.prototype.listen = function(options) {
  var self = this;

  this.stop();
  this.options = {
    interval: options.interval,
    multiple: options.multiple || 1,
    base: options.base,
    counter: options.counter
  }

  if (options.interval && options.base && options.counter) {
    this.options.reduce = true;
  } else {
    this.options.reduce = false;
  }

  // If reduce is set, setup an interval,
  // otherwise, emit each result
  if (!this.options.reduce) {
    this.createParser(this.emit);

  } else {

    this.resetBucket(options.bucket || {});

    // create regular listener
    this.createParser(function(reduced) {

      //update bucket
      self.bucket = reduce([self.bucket, reduced], true);

      // emit every time a new trade comes in,
      // as well as after the interval
      self.emit(formatReduceResult(self.bucket));
    });


    // handle first interval
    var endTime = moment.utc(this.bucket.startTime)
      .add(this.options.multiple, this.options.interval);
    var remainder = endTime.diff(moment.utc());

    //if its more than 24 days, it will overflow
    //the set timeout function. just assume no one
    //will keep the browser open that long
    if (remainder > 2073600000) return;

    // If there is time left in the first timeIncrement, wait until that
    // is finished to start the interval
    if (remainder > 0) {
      self.timeout = setTimeout(function(){
        self.finishedInterval();
        setInterval(self);

      }, remainder);

    } else {
      self.finishedInterval();
      setInterval(self);
    }
  }

  //start listening
  this.remote.on('transaction_all', self.parser);

  /**
   * setInterval
   * set interval for bucket completion
   */

  function setInterval(feed) {
    var duration = moment.duration(feed.options.multiple, feed.options.interval);
    feed.interval = setInterval(function(){
      feed.finishedInterval();
    }, duration.asMilliseconds());
  }
}

/**
 * createParser
 * returns a function that accepts txData
 * and parses it according to the options provided
 */

TradeFeed.prototype.createParser = function (callback) {
  var self = this;
  var options = this.options;

  self.parser = function(data) {
    var tx = data.transaction;
    tx.executed_time = moment.utc().unix();
    tx.metaData = data.meta;

    // use the map function to parse txContainer data
    var exchanges = parseExchanges(tx);

    exchanges.forEach(function(ex) {

      // match both
      if (options.base && options.counter) {

        // same order
        if (ex.base.currency === options.base.currency &&
            ex.base.issuer === options.base.issuer &&
            ex.counter.currency === options.counter.currency &&
            ex.counter.issuer === options.counter.issuer) {

          if (options.reduce) {
            callback(reduce([ex], false));
          } else {
            callback(ex);
          }

        // inverse order
        } else if (ex.base.currency === options.counter.currency &&
            ex.base.issuer === options.counter.issuer &&
            ex.counter.currency === options.base.currency &&
            ex.counter.issuer === options.base.issuer) {

          ex = self.invertExchange(ex);
          if (options.reduce) {
            callback(reduce([ex], false));
          } else {
            callback(ex);
          }
        }

      // only match base
      } else if (options.base) {
        if (ex.base.currency === options.base.currency &&
            ex.base.issuer === options.base.issuer) {
          callback(ex);

        } else if (ex.counter.currency === options.base.currency &&
                   ex.counter.issuer === options.base.issuer) {
          callback(self.invertExchange(ex));
        }

      // only match counter
      } else if (options.counter) {
        if (ex.counter.currency === options.counter.currency &&
            ex.counter.issuer === options.counter.issuer) {
          callback(ex);

        } else if (ex.base.currency === options.counter.currency &&
                   ex.base.issuer === options.counter.issuer) {
          callback(self.invertExchange(ex));
        }

      // return all trades
      } else {
        callback(ex);
      }
    });
  }
}

/**
 *  parseExchanges is, with three exceptions, the same as the
 *  map function used in the CouchDB view offersExercised
 *
 *  the only exceptions are 'emit' as a parameter, emit only
 *  being called once, and the line that parses the exchange_rate
 */

function parseExchanges(tx) {
  var list = [];
  var node;
  var affNode;

  if (tx.metaData.TransactionResult !== 'tesSUCCESS') {
    return list;
  }

  if (tx.TransactionType !== 'Payment' && tx.TransactionType !== 'OfferCreate') {
    return list;
  }

  for (var i=0; i<tx.metaData.AffectedNodes.length; i++) {
    affNode = tx.metaData.AffectedNodes[i];
    node    = affNode.ModifiedNode || affNode.DeletedNode;

    if (!node || node.LedgerEntryType !== 'Offer') {
      continue;
    }

    if (!node.PreviousFields || !node.PreviousFields.TakerPays || !node.PreviousFields.TakerGets) {
      continue;
    }

    node.nodeIndex = i;
    list.push(parseOfferExercised(node, tx));
  }

  return list;

  /**
   * parseOfferExercised
   * after determining the presence of an
   * excercised offer, extract it into
   * the required form
   */

  function parseOfferExercised (node, tx) {


    var counterparty = node.FinalFields.Account;
    var base;
    var counter;
    var exchangeRate;
    var change;

    if ( typeof node.PreviousFields.TakerPays === "object" ) {
      change = Amount.from_json(node.PreviousFields.TakerPays)
        .subtract(node.FinalFields.TakerPays).to_json().value;

      base = {
        currency : node.PreviousFields.TakerPays.currency,
        issuer   : node.PreviousFields.TakerPays.issuer,
        amount   : change
      }

    } else {
      change = new BigNumber(node.PreviousFields.TakerPays).minus(node.FinalFields.TakerPays);
      base   = {
        currency : 'XRP',
        amount   : change.dividedBy(XRP_ADJUST).toString()
      }
    }

    if ( typeof node.PreviousFields.TakerGets === "object" ) {
      change = Amount.from_json(node.PreviousFields.TakerGets)
        .subtract(node.FinalFields.TakerGets).to_json().value;

      counter = {
        currency : node.PreviousFields.TakerGets.currency,
        issuer   : node.PreviousFields.TakerGets.issuer,
        amount   : change
      }

    } else {
      change  = new BigNumber(node.PreviousFields.TakerGets).minus(node.FinalFields.TakerGets);
      counter = {
        currency : 'XRP',
        amount   : change.dividedBy(XRP_ADJUST).toString()
      }
    }

    try {
      exchangeRate = Amount.from_quality(node.FinalFields.BookDirectory, base.currency, base.issuer, {
        base_currency : counter.currency
      }).invert()
      .to_json().value;

    } catch (e) {
      //unable to calculate from quality
      console.log(e);
    }

    if (!exchangeRate) {
      exchangeRate = new BigNumber(counter.amount).dividedBy(base.amount).toString();
    }

    var offer = {
      base         : base,
      counter      : counter,
      rate         : exchangeRate,
      buyer        : counterparty,
      seller       : tx.Account,
      taker        : tx.Account,
      provider     : node.FinalFields.Account,
      sequence     : node.FinalFields.Sequence,
      time         : tx.executed_time,
      tx_type      : tx.TransactionType,
      tx_index     : tx.tx_index,
      ledger_index : tx.ledger_index,
      node_index   : node.nodeIndex,
      tx_hash      : tx.hash,
      client       : tx.client
    };

    return offer;
  }
};

/**
 *  reduce
 */

function reduce(values, rereduce) {

  var stats;

  if ( !rereduce ) {

    var firstTime = values[0].time, //unix timestamp
      firstPrice  = values[0].rate; //exchange rate

    // initial values
    stats = {
      openTime  : firstTime,
      closeTime : firstTime,

      open  : firstPrice,
      close : firstPrice,
      high  : firstPrice,
      low   : firstPrice,

      curr1Volume : 0,
      curr2Volume : 0,
      numTrades   : 0
    };

    values.forEach( function( trade, index ) {

      var time = trade.time; //unix timestamp
      var price = trade.rate; //exchange rate

      if (time<stats.openTime) {
        stats.openTime = time;
        stats.open     = price;
      }

      if (stats.closeTime<time) {
        stats.closeTime = time;
        stats.close     = price;
      }

      if (price>stats.high) stats.high = price;
      if (price<stats.low)  stats.low  = price;

      stats.baseVolume += trade.base.amount;
      stats.counterVolume += trade.counter.amount;
      stats.count++;
    });

    stats.vwap = stats.baseVolume / stats.counterVolume;
    return stats;

  } else {

    stats = values[0];
    if (typeof stats.openTime === 'string')
      stats.openTime  = moment.utc(stats.openTime).unix();
    if (typeof stats.closeTime === 'string')
      stats.closeTime = moment.utc(stats.closeTime).unix();

    values.forEach( function( segment, index ) {

      // skip values[0]
      if (index === 0) return;

      if (typeof segment.openTime === 'string')
        segment.openTime  = moment.utc(segment.openTime).unix();
      if (typeof segment.closeTime === 'string')
        segment.closeTime = moment.utc(segment.closeTime).unix();


      if (!stats.open || segment.openTime<stats.openTime) {
        stats.openTime = segment.openTime;
        stats.open     = segment.open;
      }
      if (!stats.close || stats.closeTime<segment.closeTime) {
        stats.closeTime = segment.closeTime;
        stats.close     = segment.close;
      }

      if (!stats.high || segment.high>stats.high) stats.high = segment.high;
      if (!stats.low  || segment.low<stats.low)   stats.low  = segment.low;

      stats.baseVolume += segment.baseVolume;
      stats.counterVolume += segment.counterVolume;
      stats.count += segment.numTrades;
    });

    stats.vwap = stats.baseVolume / stats.counterVolume;
    return stats;
  }
}


function formatReduceResult (result) {

  return {
    startTime     : result.startTime,
    openTime      : moment.utc(result.openTime).format(),
    closeTime     : moment.utc(result.closeTime).format(),
    baseVolume    : result.curr1Volume,
    counterVolume : result.curr2Volume,
    count         : result.numTrades,
    open          : result.open,
    close         : result.close,
    high          : result.high,
    low           : result.low,
    vwap          : result.volumeWeightedAvg
  };
}
