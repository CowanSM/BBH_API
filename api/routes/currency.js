
exports = module.exports = function(config, options) {
    
    var app = config.app;
    var prefix = config.mongo.prefix||'';
    var mongoModel = config.baseModel;
    
    var tunables = {};
    var tunableCollection = require(mongoModel)(prefix + 'tunables', function(ready){
        if (!ready) {
            console.error('unable to connect to ' + prefix + 'tunables');
        } else {
            tunableCollection.find({'category' : 'currency'}, function(err, result) {
                if (err || !result) {
                    console.error('unable to get tunables for currency! ' + err||'no tunables');
                } else {
                    tunables = result[0];
                    console.debug("tunables is now:");
                    console.dir(tunables);
                }
            });
        }
    }, config, options);
    
    
    app.post('/currency/:id/add', function(req, res) {
        var id = req.param('id', undefined);
        var amount = parseInt(req.param('amount', -1));
        var current = parseInt(req.param('currentAmount', -1));
        var message = req.param('message', '');
        var reason = parseInt(req.param('reason', -1));
        var seen = (req.param('seen', '') == 'true');
        var uid = req.session.uid||undefined;
        
        if (!id || amount < 1 || current < 0 || reason < 0 || !uid) {
            console.error('currency/add, missing parameters: ' + id + " " + amount + " " + current + " " + message + " " + reason + " " + seen + " " + uid);
            res.error('missing parameter(s)', {'code' : 104});
        } else {
            // get currency from table to make sure it matches user
            // optional to this is to create an array that holds each of these and index on collection id
            // not sure what the memory overhead will be though
            var currencyCollection = require(mongoModel)(prefix + id, function(coll) {
                if (!coll) {
                    console.error('unable to establish mongo collection: ' + prefix + id);
                    res.error('database error', {'code' : 105});
                } else {
                    currencyCollection.find({'_id' : uid}, function(err, currency) {
                        if (err || !currency) {
                            console.error('error getting from user currency: ' + err||'no currency for user');
                            res.error('database error', {'code' : 105});
                            // exit early here....
                            return; 
                        } else if (currency.length < 1) {
                            currency = { 'amount' : 0, '_id' : uid };
                        } else {
                            currency = currency[0];
                        }
                        
                        if (currency.amount != current) {
                            console.error("client's currency does not match our current amount", {'code' : 105});
                            res.error('currency does not match', {'code' : 104, 'currency' : currency.previousAmount});
                        } else {
                            // get the reason
                            if (reason > tunables.AddReasons.length) {
                                console.error('reason ' + reason + ' is invalid!');
                                res.error('invalid reason', {'code' : 104});
                            } else {
                                var rtext = tunables.AddReasons[reason];
                                var prevAmount = currency.amount;
                                
                                var transactionCollection = require(mongoModel)(prefix + id + '_transactions', function(tran) {
                                    if (!tran) {
                                        console.error('unable to establish collection: ' + prefix + id + '_transactions');
                                        res.error('database error', {'code' : 105});
                                    } else {
                                        var tranny = {
                                            value         : amount,
                                            timestamp     : (new Date()).toISOString(),
                                            previousAmount: prevAmount,
                                            newAmount     : prevAmount + amount,
                                            uid           : uid,
                                            seen          : seen,
                                            reason        : rtext,
                                            note          : message,
                                            operator      : 'increment'
                                        };
                                        transactionCollection.insert(tranny, function(err, result) {
                                           if (err) {
                                                console.error('error inserting into transactions collection: ' + err);
                                                res.error('database error', {'code' : 105});
                                           } else {
                                               //upsert new currency amount
                                               currency.amount = tranny.newAmount;
                                               currencyCollection.update({'_id' : uid}, currency, {'upsert' : true}, function(err, result) {
                                                   if (err) {
                                                       console.error('error upserting currency: ' + err);
                                                       res.error('database error', {'code' : 105});
                                                   } else {
                                                       res.end(JSON.stringify({'currency' : amount}));
                                                   }
                                               });
                                           }
                                        });
                                    }
                                }, config, options);
                            }
                        }
                    });
                }
            }, config, options);
        }
        
    });
    
    app.post('/currency/:id/spend', function(req, res) {
        var uid = req.session.uid||undefined;
        var cid = req.param('id', undefined);
        var current = parseInt(req.param('currentAmount', -1));
        var amount = parseInt(req.param('amount', -1));
        var item = req.param('product', undefined);
        var message = req.param('message', undefined);
        var seen = (req.param('seen', '') == "true");
        
        if (!uid || !cid || !item || !message || current < 0 || amount < 1) {
            console.error('missing parameters: ' + uid + ' ' + item + ' ' + message + ' ' + current + ' ' + amount);
            res.error('missing parameters', {'code' : 104});
        } else {
            // get our currency collections
            var currencyCollection = require(mongoModel)(prefix + cid, function(collReady) {
                var transactionCollection = require(mongoModel)(prefix + cid + '_transactions', function(tranReady) {
                    if (!collReady) {
                        console.error('unable to establish connection to currency collection: ' + prefix + cid);
                        res.error('database error', {'code' : 105});
                    } else if (!tranReady) {
                        console.error('unable to establish connection to transaction collection: ' + prefix + cid + '_transactions');
                        res.error('database error', {'code' : 105});
                    } else {
                        // check our current currency value
                        currencyCollection.find({'_id' : uid}, function(err, userCurrency) {
                            if (err || !userCurrency) {
                                console.error('error getting users currency: ' + err);
                                res.error('database error', {'code' : 105});
                            } else {
                                if (userCurrency.length < 1) {
                                    userCurrency = {'_id' : uid, 'amount' : 0};
                                } else {
                                    userCurrency = userCurrency[0];
                                }
                                
                                if (userCurrency.amount != current) {
                                    console.error('users currency does not match what is on the server');
                                    res.error('currency does not match server', {'code' : 104, 'currency' : userCurrency.amount});
                                } else if (userCurrency.amount < amount) {
                                    console.error('user is attempting to spend more currency than available! ' + userCurrency.amount + '-' + amount);
                                    res.error('not enough currency to spend', {'code' :  104, 'currency' : userCurrency.amount});
                                } else {
                                    // create transaction record
                                    var record = {
                                        uid             : uid,
                                        timestamp       : (new Date()).toISOString(),
                                        previousAmount  : userCurrency.amount,
                                        newAmount       : userCurrency.amount + amount,
                                        value           : amount,
                                        operator        : 'decrement',
                                        reason          : item,
                                        note            : message,
                                        seen            : seen
                                    };
                                    transactionCollection.insert(record, function(err, iresult) {
                                        if (err) {
                                            console.error('error inserting transaction record: ' + err);
                                            res.error('database error', {'code' : 105});
                                        } else {
                                            // now decrement the currency
                                            userCurrency.amount -= amount;
                                            currencyCollection.update({'_id' : uid}, userCurrency, {'upsert' : true}, function(err, uresult) {
                                                if (err) {
                                                    console.error('error upserting currency: ' + err);
                                                    res.error('database error', {'code' :  105});
                                                } else {
                                                    // success, return it
                                                    res.end(JSON.stringify({'currency' : userCurrency.amount}));
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                }, config, options);
            }, config, options);
        }
    });
    
    app.post('/currency/:id/get', function(req, res) {
        var uid = req.session.uid||undefined;
        var cid = req.param('id', undefined);
        
        if (!cid || !uid) {
            console.error('currency get called with missing parameters: ' + uid + ' ' + cid);
            res.error('missing parameters', {'code' : 104});
        } else {
            // get the currency collection
            var currencyCollection = require(mongoModel)(prefix + cid, function(ready) {
                if (!ready) {
                    console.error('unable to connect to collection: ' + prefix + cid);
                    res.error('database error', {'code' : 105});
                } else {
                    // get the current currency value for user
                    currencyCollection.find({'_id' : uid}, function(err, userCurrency) {
                        if (err || !userCurrency) {
                            console.error('error getting users current currency: ' + err);
                            res.error('database error', {'code' : 105});
                        } else {
                            if (userCurrency.length < 1) {
                                res.end(JSON.stringify({'currency' : 0}));
                            } else {
                                userCurrency = userCurrency[0];
                                res.end(JSON.stringify({'currency' : userCurrency.amount}));
                            }
                        }
                    });
                }
            }, config, options);
        }
    });
    
};