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

function init() {
  var x = argHandler();
  if (x) {
    if(symbolExists(x)) {
      redisClient.get('psex:lastCheck', function(err, reply) {
        if (!err) {
          if(threeMinGap(parseInt(moment(new Date()).format('x'), 10), parseInt(reply, 10))) {
            getStockQuote(
              bbUrl + x + ':' + marketSymbol
            ).then(function(data) {
              console.log(JSON.parse(data));
              redisClient.set('psex:lastCheck', parseInt(moment(new Date()).format('x'), 10), function(err, reply) {
                console.log('psex:lastCheck is ' + reply);
              });
            }).catch(function (e) {
              console.error('Error: ' + e);
            }).finally(function (e) {
              redisClient.quit();
            });
          } else {
            console.log('Wait for three more minutes');
            redisClient.quit();
          }
        } else {
          console.log('There was an error: ' + err);
          redisClient.quit();
        }
      });
    } else {
      usage();
      redisClient.quit();
    }
  } else {
    redisClient.quit();
  }
}

init();
