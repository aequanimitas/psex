var redis            = require('redis'),
    moment           = require('moment'),
    redisClient      = redis.createClient(),
    Promise          = require('bluebird'),
    seed             = require('./seed.json');

Promise.promisifyAll(redis.RedisClient.prototype);

seed.forEach(function(x) {
  redisClient.hmsetAsync('psex:pm:' + x.symbol, x)
    .catch(function(e) {
      console.error(e);
    })
    .finally(function() {
      redisClient.quit();
    });
});
