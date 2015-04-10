 exports = module.exports = function(config, options)
 {
     // create the 'tunable' structure
     var tunables = {};
     
     var buildsCollection = require(config.baseModel)(config.mongo.prefix||'' + 'builds', function(ready){
         if (!ready) {
             console.error("could not load the builds collection to get serialized data endpoint");
             config.tunables = {};
         } else {
            // load the xls from s3
            buildsCollection.find({'latest' : true}, function(err, results) {
                if (err) {
                    console.error('error getting latest build: ' + err);
                    config.tunables = {};
                } else {
                    var latest = results[0];
                    // get the endpoint
                    var html = latest.html;
                    html = html.substr(0, html.lastIndexOf('/'));
                    html +=  '/StreamingAssets/Resources/SerializedGameData.txt';
                    console.debug('html is: ' + html);
                    html = html.replace('https://', '');
                    // dl the file
                    var reqOptions = {
                        'host'      : html.substr(0, html.indexOf('/')),
                        'path'      : html.substr(html.indexOf('/'))
                    };
                    console.dir(reqOptions);
                    config.httpUtils.httpsRequest(reqOptions, function(resp, err) {
                       if (err) {
                           console.error('received error: ' + err);
                           config.tunables = {};
                       } else {
                           console.debug('received response: ' + resp);
                           
                           var temp = JSON.parse(resp);
                           
                           resp = resp.substr(resp.indexOf('{') - 1);
                           
                           for (var i in temp.Contents) {
                               if (temp.Contents[i].Class == "EngineParams") {
                                   tunables.EngineParams = temp.Contents[i].SerializedData;
                               } else if (temp.Contents[i].Class == "GameTunables") {
                                   tunables.GameTunables = temp.Contents[i].SerializedData;
                               }
                           }
                           
                           console.dir(tunables);
                           
                           config.tunables = tunables;
                       }
                    });
                }
            });
         }
     }, config, options);
     
     
 };