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
                           resp = resp.substr(resp.indexOf('{'));
                           var temp = JSON.parse(resp);
                           
                           for (var i in temp.Contents) {
                               if (temp.Contents[i].Class == "EngineParams") {
                                   var contents = JSON.parse(temp.Contents[i].SerializedData);
                                   var engine = {};
                                   for (var i in contents.Contents) {
                                       if (contents.Contents[i].Value.indexOf('|') > 0) {
                                           // array
                                           engine[contents.Contents[i].Key] = contents.Contents[i].Value.split('|');
                                       } else {
                                           engine[contents.Contents[i].Key] = contents.Contents[i].Value;
                                       }
                                   }
                                   tunables.EngineParams = engine;
                               } else if (temp.Contents[i].Class == "GameTunables") {
                                   var contents = JSON.parse(temp.Contents[i].SerializedData);
                                   var game = {};
                                   for (var i in contents.Contents) {
                                       if (contents.Contents[i].Value.indexOf('|') > 0) {
                                           // array
                                           game[contents.Contents[i].Key] = contents.Contents[i].Value.split('|');
                                       } else {
                                           game[contents.Contents[i].Key] = contents.Contents[i].Value;
                                       }
                                   }
                                   tunables.GameTunables = game;
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