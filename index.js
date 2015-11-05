var http = require('http'),
    redis = require('redis'),
    moment = require('moment'),
    redisClient = redis.createClient();

function threeMinGap(x,y) {
  return (x - y) > 18000;
}

function getStockQuote() {
  http.request('http://www.bloomberg.com/markets/chart/data/1D/TAPET:PM', function(res) {
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

function init() {
  var x = process.argv.slice(2)[0];
  redisClient.get('psex:lastCheck', function(err, reply) {
    if (!err) {
      if(threeMinGap(parseInt(moment(new Date()).format('x'), 10), parseInt(reply, 10))) {
        getStockQuote();
      } else {
        console.log('Wait for three more minutes');
        redisClient.quit();
      }
    } else {
      console.log('There was an error: ' + err);
    }
  });
}

init();
