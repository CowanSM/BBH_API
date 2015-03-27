
exports = module.exports = function(config, options) {
    
    var app = config.app;
    
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = __dirname + '/../../api_engine/base/model';
    var usersCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    
    var errorJson = function(msg, code) {
        return JSON.stringify({'error' : msg, 'error_code' : code});
    };
    
    app.publicpost('/leaderboards/:id/save', function(req, res) {
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
    
    app.publicpost('/leaderboards/:id/global', function(req, res) {
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
    
    app.publicpost('/leaderboards/:id/friends', function(req, res) {
        var ldb = req.params['id']||undefined;
        var uid = req.body['uid']||undefined;
        var ids = JSON.parse(req.body['friends']||'{}');
        
        if (!ldb || !uid || ids == {}) {
            console.error('[leaderboards/friends] missing parameters');
            res.writeHead(400);
            res.end(errorJson('missing parameters', 104));
        } else {
            res.writeHead(200);
            ids.push(uid);
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
                        var rankCycle = function(index) {
                            if (index >= result.length) {
                                res.end(JSON.stringify({'result' : result}));
                            } else {
                                collection.count({'score' : { '$gt' : result[index].score }}, function(rank) {
                                   result[index].rank = rank;
                                   rankCycle(index + 1);
                                });
                            }
                        };
                        rankCycle(0);
                    }
                });
            }
        }
    });
    
    app.publicpost('/leaderboards/:id/devFlood', function(req, res) {
        var ldb = req.params['id']||undefined;
        var uid = req.body['uid']||undefined;
        
        if (!ldb || !uid) {
            console.error('[leaderboards/devFlood] missing parameters');
            res.writeHead(400);
            res.end(errorJson('missing parameters', 104));
        } else {
            res.writeHead(200);
            usersCollection.find({'uid' : uid}, function(err, user) {
               if (err) {
                   console.error('[leaderboards/devFlood] no user');
               } else {
                   user = user[0];
                   if (!user.dev) {
                       res.end(errorJson('non-dev user accessing endpoint', 104));
                   } else {
                       // add 10000 entries to mongo for this collection...
                       var collection = require(mongoModel)(prefix + ldb, function(){}, config, options);
                       var cycle = function(index) {
                           if (index < 10000) {
                               var entry = {
                                    _id     : index,
                                    score   : Math.floor((Math.random() * 1000) + 1)
                               };
                               collection.insert(entry, function(err, result) {
                                   cycle(index + 1);
                               });
                           } else {
                               res.end(errorJson('', 0));
                           }
                       };
                       cycle(0);
                   }
               }
            });
        }
    });
};