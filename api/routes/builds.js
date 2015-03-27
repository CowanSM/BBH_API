

exports = module.exports = function(config, options) {
    var prefix = config.mongo.prefix||'';
    var model = config.baseModel; //__dirname + '/../../api_engine/base/model';
    
    var buildCollection = require(model)(prefix + 'builds', function(){}, config, options);
    
    var app = config.app;
    
    app.publicget('/builds/latest.unity3d', function(req, res) {
       // get the latest unity3d build... and return that
       var uri = undefined;
       buildCollection.find({'latest' : true}, function(err, result) {
          if (err || !result || result.length < 1) {
            console.error('[/builds/uploadBuild]', 'could not find latest build in collection:', err||'no build marked latest');
            res.writeHead(400, {'Content-Type' : 'application/json'});
            res.end(JSON.stringify({'error' : err||'no build marked latest'}));
          } else {
            // get the first result? then return the url as an octet-stream
            var entry = result[0];
            res.redirect(entry.unity3d);
          }
       });
    });
    
    app.publicget('/builds/:id.unity3d', function(req, res) {
       // get the build specified by the id (version string)
       var uri = undefined;
       var version = req.params['id']||'';
       buildCollection.find({'revision' : version}, function(err, result) {
          if (err || !result || result.length < 1) {
              console.error('[builds/id]', 'could not find a build with version string:', version, 'err:', err||'no build with version');
              res.writeHead(400);
              res.end(JSON.stringify({error: err||'no build with version exists'}));
          } else {
              var entry = result[0];
              res.redirect(entry.unity3d);
          }
       });
    });
    
    app.publicget('/builds/latest.html', function(req, res) {
       // get the latest unity3d build... and return that
       var uri = undefined;
       buildCollection.find({'latest' : true}, function(err, result) {
          if (err || !result || result.length < 1) {
            console.error('[/builds/latest]', 'could not find latest build in collection:', err||'no build marked latest');
            res.writeHead(400, {'Content-Type' : 'application/json'});
            res.end(JSON.stringify({'error' : err||'no build marked latest'}));
          } else {
            // get the first result? then return the url as an octet-stream
            var entry = result[0];
            res.writeHead(307, {'Location' : entry.html});
            res.end();
          }
       });
    });
    
    app.publicget('/builds/:id.html', function(req, res) {
       // get the build specified by the id (version string)
       var uri = undefined;
       var version = req.params['id']||'';
       buildCollection.find({'revision' : version}, function(err, result) {
          if (err || !result || result.length < 1) {
              console.error('[builds/id]', 'could not find a build with version string:', version, 'err:', err||'no build with version');
              res.writeHead(400);
              res.end(JSON.stringify({error: err||'no build with version exists'}));
          } else {
              var entry = result[0];
              res.writeHead(307, {'Location' : entry.html});
              res.end();
          }
       });
    });
    
    app.publicpost('/builds/uploadBuild', function(req, res) {
       var u3d = req.body['UrlToBinary']||undefined;
       var html = req.body['UrlToHtml']||undefined;
       var product = req.body['Product']||undefined;
       var revision = req.body['Revision']||undefined;
       var version = req.body['Version']||undefined;
       var latest = req.body['latest']||true;
       var enabled = req.body['enabled']||true;
       
       var addEntry = function() {
           var build = {
                unity3d     : u3d,
                html        : html,
                latest      : latest,
                timestamp   : new Date().toJSON(),
                enabled     : enabled,
                version     : version,
                product     : product,
                revision    : revision
           };
           buildCollection.insert(build, function(error, result) {
                if (error) {
                    console.error("[builds/uploadBuild]", 'error inserting build into mongo', error);   
                }
                res.writeHead(200);
                res.end(JSON.stringify({'error' : null}));
           });
       };
       
       if (!u3d || !html || !version || !revision) {
            console.error('[builds/uploadBuild]', 'missing parameter(s)');
            res.writeHead(400, {'Content-Type' : 'application/json'});
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