
exports = module.exports = function(config, options) {
    
    var app = config.app;
    var prefix = config.mongo.prefix||'';
    var mongoModel = config.baseModel;
    
    app.post('/transactions/:id/get', function(req, res) {
        var cid = req.param('id', undefined);
        var uid = req.session.uid||undefined;
        
        if (!cid || !uid) {
            console.error('missing parameter(s): ' + cid + ' ' + uid);
            res.error('missing parameters', {'code' : 104});
        } else {
            // get our transaction collection
            var tranCollection = require(mongoModel)(prefix + cid + '_transactions', function(ready) {
                if (!ready) {
                    console.error('could not establish connection to collection: ' + prefix + cid + '_transactions');
                    res.error('database error', {'code' : 105});
                } else {
                    // get our transactions
                    tranCollection.find({'uid' : uid}, function(err, results) {
                        if (err || !results) {
                            console.error('error finding transactions: ' + err);
                            res.error('database error', {'code' : 105});
                        } else {
                            // return our results
                            res.end(JSON.stringify({'results' : results}));
                        }
                    });
                }
            }, config, options);
        }
    });
};