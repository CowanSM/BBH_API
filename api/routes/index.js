

exports = module.exports = function(config, options) {
    var prefix = config.mongo.prefix||'';
    var model = __dirname + '/../../api_engine/base/model';
    
    var buildCollection = require(model)(prefix + 'builds', function(){}, config, options);
    
    var app = config.app;
    
    app.get('/builds/latest.unity3d', function(req, res) {
       // get the latest unity3d build... and return that
       var uri = undefined;
       buildCollection.find({'latest' : true}, function(err, result) {
          if (err || !result) {
            console.error('[/builds/uploadBuild]', 'could not find latest build in collection:', err||'no build marked latest');
            res.writeHead(400);
            res.end(JSON.stringify({'error' : err||'no build marked latest'}));
          } else {
            // get the first result? then return the url as an octet-stream
            var entry = result[0];
            res.writeHead(200, {'Content-Type' : 'application/octet-stream'});
            res.write(entry.uri);
          }
       });
    });
    
    app.post('/builds/uploadBuild', function(req, res) {
       var uri = req.body['location']||undefined;
       var version = req.body['version']||(new Date()).toDateString();
       var latest = req.body['latest']||true;
       var enabled = req.body['enabled']||true;
       
       console.log('in uploadBuild:', uri, version, latest, enabled);
       
       var addEntry = function() {
           var build = {
                uri         : uri,
                latest      : latest,
                timestamp   : new Date().toISOString(),
                enabled     : enabled
           };
           buildCollection.insert(build, function(error, result) {
                if (error) {
                    console.error("[builds/uploadBuild]", 'error inserting build into mongo', error);   
                }
                res.writeHead(200);
                res.end(JSON.stringify({'error' : null}));
           });
       };
       
       if (!uri) {
            console.error('[builds/uploadBuild]', 'missing parameter(s)');
            res.writeHead(400);
            res.end(JSON.stringify({'error' : 'missing parameter(s)'}));
       } else {
           // alright we need to create a new mongo entry so that we can reference it with FB
           if (latest) {
                // go through and mark any entry that is currently latest, as not
                buildCollection.update({'latest' : true}, {'latest' : false}, function(err, result) {
                   if (err) console.error("[builds/uploadBuild]", 'error marking entries as not-latest:', err);
                   addEntry();
                });
           } else {
                addEntry();
           }
       }
    });
    
};