var http = require('http'),
    redis = require('redis'),
    moment = require('moment'),
    Promise = require('bluebird'),
    redisClient = redis.createClient(),
    seed = require('./seed.json'),
    availableSymbols = seed.map(function(x) { return x.symbol }),
    bbUrl = 'http://www.bloomberg.com/markets/chart/data/1D/',
    marketSymbol = 'PM';

function threeMinGap(x,y) {
  return (x - y) > 18000;
}

var getStockQuote = Promise.method(function(url) {
  return new Promise(function(resolve, reject) {
    var request = http.request(url, function(response) {
      var data = '';

      response.on('data', function(c) {
        data += c.toString();
      });
      response.on('error', function(e) {
        console.log('Error: ' + e);
        reject(e);
      });
      response.on('end', function() {
        resolve(data);
      });
    });

    request.on('error', function(error) {
        console.log('Problem with request:', error.message);
        reject(error);
    });

    request.end();
  });
});

function symbolExists(x) {
  return availableSymbols.indexOf(x.toUpperCase()) > -1
}

function usage() {
  var message = 'Usage: \n';
  seed.forEach(function(x) {
    message += x.symbol + '\t' + x.companyName + '\t' + x.sector + '\n';
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

Promise.promisifyAll(redis.RedisClient.prototype);

init()
  .then(function(x) {
    if(symbolExists(x)) {
      return x; 
    } else {
      usage();
      return Promise.reject('Key doesn\'t exist');
    }
  })
  .then(function(x) {
    this.symbol = x;
    return redisClient.getAsync('psex:lastCheck');
  })
  .then(function(r) {
    return threeMinGap(parseInt(moment(new Date()).format('x'), 10), parseInt(r, 10));
  })
  .then(function(y) {
    if (y) {
      return this.symbol;
    } else {
      return Promise.reject('Wait for 3 minutes');
    }
  })
  .then(function(symbol) {
    return getStockQuote(bbUrl + symbol + ':' + marketSymbol);
  })
  .then(function(data){
    console.log(JSON.parse(data));
    return JSON.parse(data);
  }) 
  .then(function(x) {
    return redisClient.setAsync('psex:lastCheck', parseInt(moment(new Date()).format('x'), 10))
  })
  .catch(function(e) {
    console.error(e);
  })
  .finally(function() {
  redisClient.quit();
});
