
exports = module.exports = function(config, options) {
    
    var app = config.app;
    
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = config.baseModel;
    var usersCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    
    app.post('/leaderboards/:id/devFlood', function(req, res) {
        var ldb = req.param('id', undefined);
        var uid = req.session.uid||undefined;
        var count = req.param('count', 20);
        
        if (!ldb || !uid) {
            console.error('missing parameter(s)');
            res.error('missing parameters', {'code' : 104});
        } else {
            usersCollection.find({'uid' : uid}, function(err, user) {
               if (err) {
                   console.error('error finding user: ' + err);
                   res.error('database error', {'code' : 105});
               } else if (!user) {
                   res.error('no user', {'code' : 104});
               } else {
                   user = user[0];
                   if (!user.dev) {
                       console.error('non dev-user accessing endpoint');
                       res.error('not authorized for this endpoint', {'code' : 104});
                   } else {
                       count -= 1;
                       var collection = require(mongoModel)(prefix + ldb, function(coll){
                           // add 20 entries to leaderboard
                           var cycle = function(index) {
                               if (index > count) {
                                   res.end({});
                               } else {
                                   var entry = {
                                       uid      : index,
                                       score    : Math.floor(Math.random() * 100 + 1)
                                   };
                                   collection.update({'uid' : index}, entry, {'upsert' : true}, function(err, result) {
                                      if (err) console.error('error upserting into leaderboard: ' + err);
                                      cycle(index + 1);
                                   });
                               }
                           };
                           cycle(0);
                       });
                   }
               }
            });
        }
    });
    
    app.post('/leaderboards/:id/save', function(req, res) {
        var ldb = req.param('id',undefined);
        var uid = req.session.uid||undefined;
        var name = req.param('displayName', undefined);
        var score = parseInt(req.param('score',-1));
        
        if (!ldb || !uid || score < 0 || !name) {
            console.error('[leaderboards/save] missing parameter(s): ' + ldb + ' ' + uid + ' ' + name + ' ' + score);
            res.error('missing parameters', {'code' : 104});
        } else {
            // write to the collection defind
            var collection = require(mongoModel)(prefix + ldb, function() {}, config, options);
            if (!collection) {
                console.error('leaderboards/save] unable to create/access collection for ' + ldb);
                res.error('database error', {'code' : 105});
            } else {
                var post = {
                    _id     : uid,
                    score   : score,
                    name    : name
                };
                collection.update({'uid' : uid}, post, {'upsert' : true}, function(err, result) {
                    if (err) {
                        console.error('[leaderboards/save] unable to upsert: ' + post);
                        res.error('database error', 105);
                    } else {
                        res.end({});
                    }
                });
            }
        }
    });
    
    app.post('/leaderboards/:id/global', function(req, res) {
        var ldb = req.param('id', undefined);
        var uid = req.session.uid||undefined;
        var limit = parseInt(req.param('limit', 50));
        
        console.debug(ldb + " " + uid + " " + limit);
        
        if (!ldb || !uid || limit < 1) {
            res.error('missing parameters', {'code' : 104});
        } else {
            var collection = require(mongoModel)(prefix + ldb, function(coll){
                if (!coll) {
                    console.error('[leaderboards/global] could not retrieve collection ' + prefix + ldb);
                    res.error('database error', {'code' : 105});
                    return;
                }
                collection.find({}, {'limit' : limit}, function(err, result) {
                    if (err) {
                        console.error('[leaderboards/global] error getting leaderboard: ' + err);
                        res.error('database error', {'code' :  105});
                    } else if (!result) {
                        res.end(JSON.stringify({'result' : []}));
                    } else {
                        res.end(JSON.stringify({'result' : result}));
                    }
                });
            }, config, options);
        }
    });
    
    app.post('/leaderboards/:id/friends', function(req, res) {
        var ldb = req.param('id', undefined);
        var uid = req.session.uid||undefined;
        var ids = JSON.parse(req.param('friends', '[]'));
        
        if (!ldb || !uid || !ids) {
            console.error('[leaderboards/friends] missing parameters');
            res.error('missing parameters', {'code' : 104});
        } else {
            var collection = require(mongoModel)(prefix + ldb, function(coll){
                if (!coll) {
                    console.error('[leaderboards/friends could not load collection: ' + prefix + ldb);
                    res.error('no valid leaderboard found', {'code' : 104});
                } else {
                    collection.find({'_id' : {'$in' : ids}}, {'sort' : [['score',-1]]}, function(err, result) {
                        if (err) {
                            console.error('[leaderboards/friends] error getting leaderboard: ' + err);
                            res.error('database error', {'code' : 105});
                        } else if (!result) {
                            res.end(JSON.stringify({'result' : []}));
                        } else {
                            res.end(JSON.stringify({'result' : result}));
                        }
                    });
                }
            }, config, options);
        }
    });
}