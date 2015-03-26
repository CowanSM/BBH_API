exports = module.exports = function(config, options) {
    var app = config.app;
    var mongoModel = __dirname + '/../../../api_engine/base/model';
    var prefix = config.mongo.prefix||'';
    
    var Facebook = require('../../utilities/facebook/facebook')(config);
    
    // get our collections
    var receiptCollection = require(mongoModel)(prefix + 'facebookReceipts', function(){}, config, options);
    var rtuCollection = require(mongoModel)(prefix + 'facebookRTU', function(){}, config, options);
    var objectsCollection = require(mongoModel)(prefix + 'facebookPaymentObjects', function(){}, config, options);
    var userCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    var transactionCollection = require(mongoModel)(prefix + 'transactions', function(){}, config, options);

    var getPaymentsInfo = function(entries) {
        // set up recursive cycle method
        var cycle = function(index) {
            if (index >= entries.length) {
                console.log('[facebook/getPaymentsInfo]', 'finished processing payments');
            }
            else {
                Facebook.graphRequest('GET', '/v2.2/' + entries[index].id, null, function(err, result) {
                    if (err || !result) {
                        console.error('[facebook/getPaymentsInfo]', 'error with facebook request', err||'no result');
                        // continue cycle
                        cycle(index + 1);
                    } else {
                        // store object in db
                        result._id = result.id;
                        delete result.id;
                        // do update here...
                        receiptCollection.update({_id : result._id}, result, {upsert : true}, function(err, res) {
                            if (err) {
                                console.log("[facebook/getPaymentsInfo]", "error upserting result", result._id, "err:", err);
                                cycle(index + 1);
                            } else {
                                // check to see if the status is completed, if so, add to transactions collection
                                // then get the object info
                                var transactionCycle = function(index) {
                                    if (index < result.actions.length) {
                                        var action = result.actions[index];
                                        if (action.type == "charge" && action.status == "completed") {
                                            var item = result.items[index];
                                            // get item from objects collection
                                            var pid = item.product.slice(item.product.lastIndexOf('/')+1);
                                            objectsCollection.find({_id : pid}, function(err2, obj) {
                                               if (err2 || !obj) {
                                                    console.error('[facebook/getPaymentsInfo]', 'could not find object matching id:', pid, err2);
                                                    transactionCycle(index + 1);
                                               } else {
                                                    // get the hard currency value of the object bought
                                                    obj = obj[0];
                                                    var transaction = {
                                                        value       : obj.hardCurrencyValue,
                                                        timestamp   : (new Date()).toISOString()
                                                    };
                                                    // get users current hardcurrency
                                                    userCollection.find({'uid' : result.user.id}, function(err3, user) {
                                                        if (err3 || !user) {
                                                            console.error('[facebook/getPaymentsInfo]', 'could not find user with fbid:', result.user.id, err3); 
                                                            transactionCycle(index + 1);
                                                        } else {
                                                            user = user[0];
                                                            transaction.previousAmount = user.hardCurrency||0;
                                                            transaction.newAmount = transaction.previousAmount + transaction.value;
                                                            transaction.userId = result.user.id;
                                                            transaction.seen = false;
                                                            // add to users' currency
                                                            userCollection.update({'uid' : result.user.id}, {'hardCurrency' : transaction.newAmount}, function(err4, result2) {
                                                               if (err4) {
                                                                   console.error('[facebook/getPaymentsInfo]', 'could not update user"s hard currency value', result.user.id, err4);
                                                                   transaction.user_updated = false;   
                                                               } else {
                                                                   transaction.user_updated = true;
                                                               }
                                                               transactionCollection.insert(transaction, function(err5, result3) {
                                                                  if (err5) {
                                                                    console.error('[facebook/getPaymentsInfo]', 'could not add transaction', transaction, err5);   
                                                                  }
                                                                  transactionCycle(index + 1);
                                                               });
                                                            });
                                                        }
                                                    });
                                               }
                                            });
                                        }
                                        transactionCycle(index + 1);
                                    } else {
                                        // done...?   
                                    }
                                };
                                transactionCycle(0);
                            }
                        });
                    }
                });
            }
        };
        cycle(0);
    };
    
    app.publicpost("/facebook/login", function(req, res) {
       var accessToken = req.body["access_token"]||"";
       var userId = req.body["user_id"]||"";
       var expirationToken = req.body["expires"]||"";
       
       // just stick it into mongo for now
       if (accessToken) {
           var user = {
             access_token       : accessToken,
             fbid               : userId,
             expiresAt          : expirationToken
           };
           userCollection.update({'uid' : userId}, user, {upsert : true}, function(err, result) {
              if (err) {
               console.error('error upserting user into db:', err);   
              }
           });
       }
       
        res.writeHead(200);
        res.end('ok');
    });
    
    // endpoint for getting a payment object from mongo
    app.publicall("/facebook/payobject/:id", function(req, res) {
        // need to watch for the challenge request
        var fb_mode = req.query['hub.mode'] || 0;
        var id = req.params['id']||-1;
        
        console.log('looking for object id:', id);
        
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
            console.log('looking up in collection');
           // normally perform lookup on the id provided and return that rendered, but for testing just render the template
           objectsCollection.find({_id: String(id)}, function(err, result) {
               if (err || !result) {
                    console.error('[facebook/paymentObject]', 'unable to get object with id', id, 'err:', err||'no object with that id');   
                    res.writeHead(400);
                    res.end('no object found with given id');
               } else {
                   result = result[0];
                   var data = {
                       title        : result.title,
                       description  : result.description,
                       plural       : result.plural,
                       usd          : result.usd,
                       url          : 'http://' + req.get('host') + '/facebook/payobject/' + id,
                   };
                   console.dir(data);
                   return res.render(__dirname + '/../../templates/object_payment.ejs', data);
               }
           });
        }
    });

    app.publicall("/facebook/payments", function(req, res) {
        var fb_mode = req.query['hub.mode'] || 0;

        // set response values
        var statusCode = 200;
        var responseText = "ok";

        if (!fb_mode) {
            if (req.body) {
                var jsonBody = req.body;
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