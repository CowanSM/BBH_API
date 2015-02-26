var Facebook = require('../../utilities/facebook/facebook');

exports = module.exports = function(config, options) {
    var app = config.app;
    var mongoModel = __dirname + '/../../../api_engine/base/model';
    var prefix = config.mongo.prefix||'';
    
    // get our collections
    var paymentCollection = require(mongoModel)(prefix + 'payemnts', function(){}, config, options);
    var rtuCollection = require(mongoModel)(prefix + 'rtu', function(){}, config, options);
    var paymentObjectsCollection = require(mongoModel)(prefix + 'paymentObjects', function(){}, config, options);

    var getPaymentsInfo = function(entries) {
        // set up recursive cycle method
        var cycle = function(index) {
            if (index >= entries.length) {
                console.log('[facebook/getPaymentsInfo]', 'finished processing payments');
            }
            else {
                Facebook.graphRequest('GET', '/' + entries[index].id, null, function(err, result) {
                    if (err || !result) {
                        console.error('[facebook/getPaymentsInfo]', 'error with facebook request', err||'no result');
                        // continue cycle
                        cycle(index + 1);
                    } else {
                        // store object in db
                        result._id = result.id;
                        delete result.id;
                        // do update here...
                        paymentCollection.update({_id : result._id}, result, {upsert : true}, function(err, res) {
                            if (err) console.log("[facebook/getPaymentsInfo]", "error upserting result", result._id, "err:", err);
                            cycle(index + 1);
                        });
                    }
                });
            }
        };
        cycle(0);
    };
    
    // endpoint for getting a payment object from mongo
    app.all("/facebook/payobject/:id", function(req, res) {
        // need to watch for the challenge request
        var fb_mode = req.query['hub.mode'] || 0;
        var id = req.param('id')||-1;
        
        if (fb_mode) {
            var statusCode = 200;
            var responseText = "ok";
            if (fb_mode == "subscribe") {
                // check the verify token
				var verify = req.query['hub.verify_token']||'';
                if (verify != config.facebook.verification_token) {
                    statusCode = 400;
                    responseText = "invalid verification token sent";
                }
                else {
                    responseText = req.query['hub.challenge'] || "not-ok";
                }
            }
            else {
                console.log("[facebook/payments]", "unhandled fb mode", fb_mode);
                statusCode = 400;
                responseText = "not-ok";
            }
            res.writeHead(statusCode);
            res.end(responseText);
        } else {
           // normally perform lookup on the id provided and return that rendered, but for testing just render the template
           paymentObjectsCollection.find({_id: id}, function(err, result) {
               if (err || !result) {
                    console.error('[facebook/paymentObject]', 'unable to get object with id', id, 'err:', err||'no object with that id');   
                    res.writeHead(400);
                    res.end('no object found with given id');
               } else {
                   var data = {
                       title        : result.title,
                       description  : result.description,
                       plural       : result.plural,
                       usd          : result.usd,
                       url          : 'http://' + req.get('host') + '/facebook/payobject/' + id,
                   };
                   return res.render(__dirname + '/../../templates/object_payment.ejs', data);
               }
           });
        }
    });

    app.all("/facebook/payments", function(req, res) {
        var fb_mode = req.query['hub.mode'] || 0;

        // set response values
        var statusCode = 200;
        var responseText = "ok";

        if (!fb_mode) {
            console.log('rawbody:', req.body);
            if (req.rawBody) {
                var jsonBody = JSON.parse(req.rawBody);
                if (jsonBody.object && jsonBody.object == "payments") {
                    for (var i in jsonBody.entry) {
                        // insert into real-time updates collection
                        rtuCollection.insert(jsonBody.entry[i], function(err, result) {
                            if (err) console.log('[facebook/payments]', 'error inserting into rtu collection', err);
                        });
                    }
                    
                    // get info from fb for each entry
                    getPaymentsInfo(jsonBody.entry);
                } else {
                    console.error('[facebook/payments]', 'unknown request', jsonBody);
                    statusCode = 400;
                    responseText = 'unknown request';
                }
            } else {
                console.error('[facebook/payments]', 'unknown request');
                statusCode = 400;
                responseText = 'unknown request';
            }
        }
        else {
            if (fb_mode == "subscribe") {
                // check the verify token
				var verify = req.query['hub.verify_token']||'';
                if (verify != config.facebook.verification_token) {
                    statusCode = 400;
                    responseText = "invalid verification token sent";
                }
                else {
                    responseText = req.query['hub.challenge'] || "not-ok";
                }
            }
            else {
                console.log("[facebook/payments]", "unhandled fb mode", fb_mode);
                statusCode = 400;
                responseText = "not-ok";
            }
        }

        // send reply
        res.writeHead(statusCode, {"Content-Type": "text/plain"});
        res.end(responseText);
    });

}