exports = module.exports = function(config, options) {
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = __dirname + '/../../api_engine/base/model';
    var usersCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    
    var app = config.app;
    
    app.post('/user_data/save', function(req, res) {
        var id = req.body['fbid']||req.params['fbid']||undefined;
        var data = req.body['data']||req.params['data']||undefined;
        if (id && data) {
            // it is safe to assume that the user is valid at this point
            // below may be uneccessary, but it does serve as a form of user validation
            usersCollection.find({'fbid' : id}, function(err, result) {
                if (err || !result) {
                    console.error('[user_data/save]', 'error getting user from table:', err||'no user was found with id');
                    res.writeHead(200);
                    res.end(JSON.stringify({'error':err||'no user found with fbid'}));
                } else {
                    // save the data
                    usersCollection.update({'fbid' : id}, {'data': data}, function(err, result) {
                       if (err) console.error('[user_data/save]', 'error saving the data:', err);
                       res.writeHead(200);
                       res.end(JSON.stringify({'error':err}));
                    });
                }
            });
        } else {
            res.writeHead(400);
            res.end(JSON.stringify({'error':'missing parameters'}));
        }
    });
    
    app.post('/user_data/load', function(req, res) {
        var id = req.body['fbid']||req.params['fbid']||undefined;
        if (id) {
            usersCollection.find({'fbid' : id}, function(err, result) {
               if (err || !result) {
                    console.error('[user_data/load]', 'error getting user from collection:', err||'no user with fbid');
                    res.writeHead(200);
                    res.end(JSON.stringify({'error' : err||'no user found'}));
               } else {
                   var user = result[0];
                   console.log('found user:');
                   console.dir(user);
                   res.writeHead(200);
                   res.end(JSON.stringify({'error' : null, 'data' : user.data}));
               }
            });
        } else {
            res.writeHead(400);
            res.end(JSON.stringify({'error':'missing parameters'}));
        }
    });
};