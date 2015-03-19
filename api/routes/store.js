

exports = module.exports = function(config, options) {
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = __dirname + '/../../api_engine/base/model';
    var storeItemCollection = require(mongoModel)(prefix + 'paymentObjects', function(){}, config, options);
    
    var app = config.app;
    
    app.all('/store/getAll', function(req, res) {
       storeItemCollection.find({}, function(err, results) {
          if (err || !results) {
                console.error('[store/getAll]', 'error getting store items:', err||'no store items');
                res.writeHead(200);
                res.end(JSON.stringify({'error' : err||'no store items'}));
          } else {
                res.writeHead(200);
                res.end(JSON.stringify(results));
          }
       });
    });
};