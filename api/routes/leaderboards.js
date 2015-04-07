
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
                       var ids = [
                           1374688942853304,
                           1378320352487605,
                           1380392548945979,
                           1396232284023518
                       ];
                       var collection = require(mongoModel)(prefix + ldb, function(coll){
                           // add 20 entries to leaderboard
                           var cycle = function(index) {
                               if (index > count) {
                                   res.end({});
                               } else {
                                   var id = ids.pop()||index;
                                   var entry = {
                                       uid      : id,
                                       score    : Math.floor(Math.random() * 100 + 1),
                                       _id      : id,
                                       name     : "flood_user" + id
                                   };
                                   collection.update({'_id' : id}, entry, {'upsert' : true}, function(err, result) {
                                      if (err) console.error('error upserting into leaderboard: ' + err);
                                      cycle(index + 1);
                                   });
                               }
                           };
                           cycle(0);
                       }, config, options);
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
            var collection = require(mongoModel)(prefix + ldb, function(ready) {
                if (!ready) {
                    console.error('leaderboards/save] unable to create/access collection for ' + ldb);
                    res.error('database error', {'code' : 105});
                } else {
                    var post = {
                        _id     : uid,
                        score   : score,
                        name    : name,
                        uid     : uid
                    };
                    collection.update({'_id' : uid}, post, {'upsert' : true}, function(err, result) {
                        if (err) {
                            console.error('[leaderboards/save] unable to upsert: ' + post);
                            res.error('database error', {'code' : 105});
                        } else {
                            res.end({});
                        }
                    });
                }
            }, config, options);
        }
    });
    
    app.post('/leaderboards/:id/global', function(req, res) {
        var ldb = req.param('id', undefined);
        var uid = req.session.uid||undefined;
        var limit = parseInt(req.param('limit', 50));
        
        if (!ldb || !uid || limit < 1) {
            res.error('missing parameters', {'code' : 104});
        } else {
            var collection = require(mongoModel)(prefix + ldb, function(coll){
                if (!coll) {
                    console.error('[leaderboards/global] could not retrieve collection ' + prefix + ldb);
                    res.error('database error', {'code' : 105});
                    return;
                }
                collection.find({}, {'limit' : limit, 'sort' : {'score' : -1 }}, function(err, result) {
                    if (err) {
                        console.error('[leaderboards/global] error getting leaderboard: ' + err);
                        res.error('database error', {'code' :  105});
                    } else if (!result) {
                        res.end(JSON.stringify({'result' : []}));
                    } else {
                        for (var i in result) {
                            delete result[i]._id;
                            result[i].rank = parseInt(i) + 1;
                        }
                        res.end(JSON.stringify({'result' : result}));
                    }
                });
            }, config, options);
        }
    });
    
    app.post('/leaderboards/:id/friends', function(req, res) {
        var ldb = req.param('id', undefined);
        var uid = req.session.uid||undefined;
        var ids = req.param('friends', '[]');
        
        console.debug("friend ids are:");
        console.dir(ids);
        
        if (!ldb || !uid || !ids) {
            console.error('[leaderboards/friends] missing parameters');
            res.error('missing parameters', {'code' : 104});
        } else {
            var collection = require(mongoModel)(prefix + ldb, function(coll){
                if (!coll) {
                    console.error('[leaderboards/friends could not load collection: ' + prefix + ldb);
                    res.error('no valid leaderboard found', {'code' : 104});
                } else {
                    usersCollection.find({'uid' : {'$in' : ids}}, function(err, users) {
                        if (err || !users) {
                            console.error('could not get users: ' + err);
                            res.error('database error', {'code' : 105});
                        } else if (users.length > 0) {
                            var uids = [];
                            for (var i in users) {
                                uids.push(users[i].uid);
                            }
                            collection.find({'_id' : {'$in' : uids}}, {'sort' : [['score',-1]]}, function(err, result) {
                                if (err) {
                                    console.error('[leaderboards/friends] error getting leaderboard: ' + err);
                                    res.error('database error', {'code' : 105});
                                } else if (!result) {
                                    res.end(JSON.stringify({'result' : []}));
                                } else {
                                    // get ranks for each
                                    var cycle = function(index) {
                                        if (index >= result.length) {
                                            res.end(JSON.stringify({'result' : result}));
                                        } else {
                                            delete result[index]._id;
                                            collection.count({'score' : { '$gt' : result[index].score }}, function(err, count) {
                                                if (err) {
                                                    console.error('error getting count for user: ' + result[index].uid);
                                                } else {
                                                    result[index].rank = count + 1;
                                                }
                                                cycle(index+1);
                                            });
                                        }
                                    };
                                    cycle(0);
                                }
                            });
                        } else {
                            // no friends :(
                            res.end({'result' : []});
                        }
                    });
                }
            }, config, options);
        }
    });
}