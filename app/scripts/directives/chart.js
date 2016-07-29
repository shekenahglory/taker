angular
.module('chart', [])
.directive('chart', function($http) {
  var API = 'https://data.ripple.com/v2/';

  return {
    restrict: 'AE',
    link: function(scope, element, attr) {
      element.addClass('chart');

      var div = d3.select(element[0]);
      var timeFormat = "%Y-%m-%dT%H:%M:%S";
      var margin = {top: 0, right: 0, bottom: 30, left: 0};
      var width = element.width() > 200 ? element.width() : 300;
      var height = element.height() > 200 ? element.height() : 300;
      var parseDate = d3.time.format(timeFormat).parse;

      width -= margin.left + margin.right,
      height -= margin.top + margin.bottom;

      var x = techan.scale.financetime()
        .range([0, width]);

      var y = d3.scale.linear()
        .range([height, 0]);

      var yVolume = d3.scale.linear()
        .range([y(0), y(0.3)]);

      var ohlc = techan.plot.candlestick()
        .xScale(x)
        .yScale(y);

      var sma0 = techan.plot.sma()
        .xScale(x)
        .yScale(y);

      var sma0Calculator = techan.indicator.sma()
        .period(25);

      var sma1 = techan.plot.sma()
        .xScale(x)
        .yScale(y);

      var sma1Calculator = techan.indicator.sma()
        .period(50);

      var volume = techan.plot.volume()
        .accessor(ohlc.accessor())   // Set the accessor to a ohlc accessor so we get highlighted bars
        .xScale(x)
        .yScale(yVolume);

      var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

      var yAxis = d3.svg.axis()
        .scale(y)
        .orient("right");

      var volumeAxis = d3.svg.axis()
        .scale(yVolume)
        .orient("left")
        .ticks(3)
        .tickFormat(d3.format(",.3s"))

      var timeAnnotation = techan.plot.axisannotation()
        .axis(xAxis)
        .format(d3.time.format('%Y-%m-%d %X'))
        .width(100)
        .translate([0, height]);

      var ohlcAnnotation = techan.plot.axisannotation()
        .axis(yAxis)
        .format(d3.format(',.4r'))

      var volumeAnnotation = techan.plot.axisannotation()
        .axis(volumeAxis)
        .width(35)
        .translate([width, 0]);

      var crosshair = techan.plot.crosshair()
        .xScale(x)
        .yScale(y)
        .xAnnotation(timeAnnotation)
        .yAnnotation([ohlcAnnotation, volumeAnnotation]);

      var svg = div.append('svg')
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

      var defs = svg.append("defs");

      defs.append("clipPath")
        .attr("id", "ohlcClip")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);

      svg = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var ohlcSelection = svg.append("g")
        .attr("class", "ohlc")
        .attr("transform", "translate(0,0)");

      ohlcSelection.append("g")
        .attr("class", "volume")
        .attr("clip-path", "url(#ohlcClip)");

      ohlcSelection.append("g")
        .attr("class", "candlestick")
        .attr("clip-path", "url(#ohlcClip)");

      ohlcSelection.append("g")
        .attr("class", "indicator sma ma-0")
        .attr("clip-path", "url(#ohlcClip)");

      ohlcSelection.append("g")
        .attr("class", "indicator sma ma-1")
        .attr("clip-path", "url(#ohlcClip)");

      svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")");

      svg.append("g")
        .attr("class", "y axis")
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")

      svg.append("g")
        .attr("class", "volume axis")
        .attr("transform", "translate(" + width + ", 0)");

      svg.append('g')
        .attr("class", "crosshair ohlc");

      var data;
      var start;
      var end;

      function load(data, start, end) {
        var accessor = ohlc.accessor();
        var points = [];

        data.forEach(function(d) {
          d.date = parseDate(d.date);
          console.log(d.date);
        });

        data.sort(function(a, b) {
          return d3.ascending(accessor.d(a), accessor.d(b));
        });

        svg.select("g.candlestick").html('').datum(data);
        svg.select("g.sma.ma-0").html('').datum(sma0Calculator(data));
        svg.select("g.sma.ma-1").html('').datum(sma1Calculator(data));
        svg.select("g.volume").html('').datum(data);
        svg.select("g.volume.axis").html('');
        svg.select('g.x.axis').html('');
        svg.select('g.y.axis').html('');
        svg.select("g.crosshair.ohlc").html('');

        //redraw();
        if (data.length) {

          end.add(18, 'hours');
          start.subtract(24, 'hours');
          while(start.diff(end)) {
            points.push(parseDate(start.format('YYYY-MM-DDTHH:mm:ss')));
            start.add(1, 'hour');
          }

          x.domain(points);
          //x.domain(data.map(accessor.d));
          //x.zoomable().domain([0, data.length]);

          y.domain(techan.scale.plot.ohlc(data).domain());
          yVolume.domain(techan.scale.plot.volume(data).domain());

          svg.select('g.x.axis').call(xAxis);
          svg.select('g.y.axis').call(yAxis);
          svg.select("g.volume.axis").call(volumeAxis);

          svg.select("g.candlestick").call(ohlc);

          // Recalculate indicators
          svg.select("g.sma.ma-0").call(sma0);
          svg.select("g.sma.ma-1").call(sma1);

          svg.select("g.volume").call(volume);
          svg.select("g.crosshair.ohlc").call(crosshair);
        }
      }

      scope.$watch('chartOptions', function(options) {
        var data = [];
        var start;
        var end;
        var base;
        var counter;
        var url;

        if (options) {

          load(data);

          base = options.base.currency +
            (options.base.issuer ? '+' + options.base.issuer : '');
          counter = options.counter.currency +
            (options.counter.issuer ? '+' + options.counter.issuer : '');

          end = moment.utc().startOf('hour').add(1, 'hour');
          start = moment(end).subtract(10, 'days');

          url = API + 'exchanges/' + base + '/' + counter +
            '?limit=1000&interval=1hour' +
            '&start=' + start.format('YYYY-MM-DDTHH:mm:ss') +
            '&end=' + end.format('YYYY-MM-DDTHH:mm:ss');

          $http.get(url).success(function(resp) {
            var data = [];
            resp.exchanges.forEach(function(d) {
              data.push({
                date: d.start,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.base_volume
              });
            });

            load(data, start, end);
          }).error(function(err) {
            console.log(err);
          });
        }
      });
    }
  }
});
