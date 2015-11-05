var http = require('http'),
    redis = require('redis'),
    moment = require('moment'),
    redisClient = redis.createClient(),
    seed = require('./seed.json'),
    availableSymbols = seed.map(function(x) { return x.symbol }),
    bbUrl = 'http://www.bloomberg.com/markets/chart/data/1D/',
    marketSymbol = 'PM';

function threeMinGap(x,y) {
  return (x - y) > 18000;
}

function getStockQuote(symbol) {
  http.request(bbUrl + symbol + ':' + marketSymbol, function(res) {
   var data = '';
   res
   .on('data', function(c) {
     data += c.toString();
   })
   .on('end', function() {
     console.log(JSON.parse(data));
     redisClient.set('psex:lastCheck', parseInt(moment(new Date()).format('x'), 10), function(err, reply) {
       console.log('psex:lastCheck is ' + reply);
       redisClient.quit();
     });
   })
   .on('error', function(e) {
     console.error(e);
     redisClient.quit();
   });
  }).end();
}

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
            getStockQuote(x);
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
