var http             = require('http'),
    redis            = require('redis'),
    moment           = require('moment'),
    Promise          = require('bluebird'),
    redisClient      = redis.createClient(),
    seed             = require('./seed.json'),
    appInfo             = require('./package.json'),
    availableSymbols = seed.map(function(x) { return x.symbol }),
    bbUrl            = 'http://www.bloomberg.com/markets/chart/data/1D/',
    marketSymbol     = 'PM';

Promise.promisifyAll(redis.RedisClient.prototype);

var getStockQuote = Promise.method(function(url) {
  return new Promise(function(resolve, reject) {
    var request = http.request(url, function(response) {
      var data = '';

      response.on('data', function(c) {
        data += c.toString();
      });
      response.on('error', function(e) {
        console.log(`Error: ${e}`);
        reject(e);
      });
      response.on('end', function() {
        resolve(data);
      });
    });

    request.on('error', function(error) {
        console.log(`Problem with request: ${error.message}`);
        reject(error);
    });

    request.end();
  });
});

function symbolExists(x) {
  return availableSymbols.indexOf(x.toUpperCase()) > -1
}

function usage() {
  var message = `${appInfo.name} ${appInfo.version}\n` + 'Usage: \n';
  seed.forEach(function(x) {
    message += `${x.symbol} \t ${x.companyName} \t ${x.sector}\n`;
  });
  console.log(message);
}

function argHandler() {
  var x, args = process.argv.slice(2);
  if (args.length == 0) {
    usage();
    return undefined;
  } else {
    x = args[0];
    return x;
  }
}

var init = Promise.method(function() {
  return new Promise(function(resolve, reject) {
    var x = argHandler();
    if (x) {
      resolve(x);
    } else {
      reject(x);
    }
  });
});


init()
  .then(function(x) {
    return symbolExists(x) ? x : (
          usage(),
          Promise.reject('Key doesn\'t exist')
        )
  })
  .then(function(x) {
    this.symbol = x;
    return redisClient.getAsync('psex:lastCheck');
  })
  .then(function(r) {
    // timeout for 1 minute
    return [((moment(new Date()) - r)) > 60000, r]
  })
  .then(function(y) {
    var seconds = (60 - moment(new Date()).subtract(y[1]).second()).toString().split('.')[0];
    return y[0] ? this.symbol : 
                  Promise.reject(`Wait for ${ seconds } seconds before issung a new request`);
  })
  .then(function(symbol) {
    return getStockQuote(`${bbUrl}${symbol}:${marketSymbol}`);

  })
  .then(function(data){
    var arr = JSON.parse(data);
    var model = {
      'Symbol': this.symbol,
      'marketOpen': moment(arr.exch_open_time).format(),
      'marketClose': moment(arr.exch_close_time).format(),
      'lastTradingPrice': arr.data_values[arr.data_values.length - 1][1],
      'openPrice': arr.data_values[0][1],
    };
    console.dir(model);
    return JSON.parse(data);
  }) 
  .then(function(x) {
    return redisClient.setAsync('psex:lastCheck', moment(new Date()).format('x'));
  })
  .catch(function(e) {
    console.error(e);
  })
  .finally(function() {
    redisClient.quit();
  });
