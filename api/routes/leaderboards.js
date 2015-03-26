
exports = module.exports = function(config, options) {
    
    var app = config.app;
    
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = __dirname + '/../../api_engine/base/model';
    var usersCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    
    var errorJson = function(msg, code) {
        return JSON.stringify({'error' : msg, 'error_code' : code});
    };
    
    app.post('/leaderboards/:id/save', function(req, res) {
        var ldb = req.params['id']||undefined;
        var uid = req.body['uid']||undefined;
        var score = parseInt(req.body['score']||-1);
        
        if (!ldb || !uid || score < 0) {
            console.error('[leaderboards/save] missing parameter(s)');
            res.writeHead(400);
            res.end(errorJson('missing parameters', 104));
        } else {
            res.writeHead(200);
            // write to the collection defind
            var collection = require(mongoModel)(prefix + ldb, function() {}, config, options);
            if (!collection) {
                console.error('leaderboards/save] unable to create/access collection for ' + ldb);
                res.end(errorJson('database error', 105));
            } else {
                var post = {
                    _id     : uid,
                    score   : score
                };
                collection.update({'uid' : uid}, post, {'upsert' : true}, function(err, result) {
                    if (err) {
                        console.error('[leaderboards/save] unable to upsert: ' + post);
                        res.end(errorJson('database error', 105));
                    } else {
                        res.end(errorJson('', 0));
                    }
                });
            }
        }
    });
    
    app.post('/leaderboards/:id/global', function(req, res) {
        var ldb = req.params['id']||undefined;
        var uid = req.body['uid']||undefined;
        var limit = parseInt(req.body['limit']||-1);
        
        if (!ldb || !uid || limit < 1) {
            console.error('[learderboards/global] missing parameter(s)');
            res.writeHead(400);
            res.end(errorJson('missing parameters', 104));
        } else {
            res.writeHead(200);
            var collection = require(mongoModel)(prefix + ldb, function(){}, config, options);
            if (!collection) {
                console.error('[leaderboards/global] could not retrieve collection ' + prefix + ldb);
                res.end(errorJson('database error', 105));
            } else {
                collection.find({}, {'limit' : limit}, function(err, result) {
                    if (err) {
                        console.error('[leaderboards/global] error getting leaderboard: ' + err);
                        res.end(errorJson('database error', 105));
                    } else if (!result) {
                        res.end(JSON.stringify({'result' : []}));
                    } else {
                        console.log('[leaderboards/global] got back leaderboard:');
                        console.dir(result);
                        res.end(JSON.stringify({'result' : result}));
                    }
                });
            }
        }
    });
    
    app.post('/leaderboards/:id/friends', function(req, res) {
        var ldb = req.params['id']||undefined;
        var uid = req.body['uid']||undefined;
        var ids = JSON.parse(req.body['friends']||'{}');
        
        if (!ldb || !uid || ids == {}) {
            console.error('[leaderboards/friends] missing parameters');
            res.writeHead(400);
            res.end(errorJson('missing parameters', 104));
        } else {
            res.writeHead(200);
            var collection = require(mongoModel)(prefix + ldb, function(){}, config, options);
            if (!collection) {
                console.error('[leaderboards/friends could not load collection: ' + prefix + ldb);
                res.end(errorJson('no leaderboard by that name', 104));
            } else {
                collection.find({'_id' : {'$in' : ids}}, {'sort' : [['score',-1]]}, function(err, result) {
                    if (err) {
                        console.error('[leaderboards/friends] error getting leaderboard: ' + err);
                        res.end(errorJson('database error', 105));
                    } else if (!result) {
                        res.end(JSON.stringify({'result' : []}));
                    } else {
                        console.log('[leaderboards/friends] got result:');
                        console.dir(result);
                        res.end(JSON.stringify({'result' : result}));
                    }
                });
            }
        }
    });
};