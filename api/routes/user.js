var http = require('http');
var https = require('https');
var _ = require("underscore");

exports = module.exports = function(config, options)
{
    var app = config.app;
    
    var userServices = config.services||[];
    
    // temporary until V checks in some stuff:
    //userServices.push(require('../utilities/parse/parse')(config));
    /////////////////////////////////////////////////////////////// 
    
    var httpUtils = config.httpUtils;
    
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = __dirname + '/../../api_engine/base/model';
    var usersCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    var transactionCollection = require(mongoModel)(prefix + 'transactions', function(){}, config, options);
    
    // function for tieing-in session info
    var getSession = function(user, callback) 
    {
        //Vedad - add shit here
        //function to "register" user. needs to return api server address, expiry token, 
        
        var data = {
            uid     : '1234abcd'
        };
        
        config.sessions.createSession(data, function(session)
        {
            console.log('session : ' + JSON.stringify(session));
            
            return callback({session:session});
        });
    };
    
    var errorJson = function(msg, code) {
        return JSON.stringify({'error' : msg, 'error_code' : code});
    };
    
    app.post('/users/addCurrency', function(req, res) {
       var id = req.body['id']||undefined;
       var amount = req.body['amount']||undefined;
       var reason = req.body['reason']||undefined;
       var message = req.body['message']||'';
       var seen = (req.body['seen']||"" == "true");
       var current = req.body['currentAmount']||undefined;
       
       if (!id || !amount || !reason || !current) {
           console.error('[users/addCurrency]', 'endpoint called with missing parameter(s)');
           res.writeHead(400);
           res.end(errorJson('missing parameter(s)', 104));
       } else {
           // check that the reason is valid...
           var rtext = "";
           var error = undefined;
           switch (reason) {
               case 0:
                   // level up
                   rtext = "Level Up";
                   break;
               
               default:
                   // code
                   error = "Invalid Reason given: " + reason;
                   break;
           }
           
           if (error) {
               res.writeHead(200);
               res.end(errorJson('invalid reason given', 104));
           } else {
               usersCollection.find({'uid' : id}, function(err, user) {
                  if (err || !user) {
                      console.error('[users/addCurrency]', 'error looking for user', id, err||'no user found');
                      res.writeHead(200);
                      res.end(errorJson('database error', 105));
                  } else {
                      user = user[0];
                      if (current != user.hardCurrency) {
                          console.error('[users/addCurrency]', 'client has different amount of currency locally');
                          res.writeHead(200);
                          res.end(errorJson('client currency out-of-sync', 106));
                      }
                      
                      var transaction = {
                          value         : amount,
                          timestamp     : (new Date()).toISOString(),
                          previousAmount: user.hardcurrency,
                          newAmount     : user.hardcurrency + amount,
                          userId        : id,
                          seen          : seen,
                          reason        : rtext + ' - ' + message
                      };
                      transactionCollection.insert(transaction, function(err2, result2) {
                         if (err2) {
                             console.error('[users/addCurrency]', 'error inserting transaction', err);
                             res.writeHead(200);
                             res.end(errorJson('database error', 105));
                         } else {
                             usersCollection.update({'uid' : id}, {'hardCurrency' : transaction.newAmount}, function(err3, result3) {
                                if (err3) {
                                    console.error('[users/addCurrency]', 'error updating users hard currency:', err3);
                                    res.writeHead(200);
                                    res.end(errorJson('database error', 105));
                                } else {
                                    res.writeHead(200);
                                    res.end(JSON.strinify({'currency' : transaction.newAmount}));
                                }
                             });
                         }
                      });
                  }
               });
           }
       }
    });
    
    app.post('/users/spendCurrency', function(req, res) {
        var id = req.body['id']||undefined;
        var current = req.body['currentAmount']||undefined;
        var amount = req.body['amount']||undefined;
        var item = req.body['product']||undefined;
        var message = req.body['message']||'';
        var seen = (req.body['seen']||"true" == "true");
        
        if (!id || !current || !amount || !item) {
            console.error('[users/spendCurrency]', 'missing parameter(s)');
            res.writeHead(400);
            res.end(errorJson('missing parameter(s)', 104));
        } else {
            res.writeHead(200);
            usersCollection.find({'uid' : id}, function(err, user) {
               if (err || !user) {
                   console.error('[users/spendCurrency]', 'error getting user', id, err||'no user');
                   res.end(errorJson('database error', 105));
               } else {
                   user = user[0];
                   if (user.hardCurrency != current) {
                       res.end(errorJson('client currency out-of-sync', 106));
                   } else if (user.hardCurrency < amount) {
                       res.end(errorJson('client currency out-of-sync - too little', 106));
                   } else {
                       var transaction = {
                          value         : amount,
                          timestamp     : (new Date()).toISOString(),
                          previousAmount: user.hardcurrency,
                          newAmount     : user.hardcurrency - amount,
                          userId        : id,
                          seen          : seen,
                          reason        : item + ' - ' + message
                       };
                       transactionCollection.insert(transaction, function(err2, result2) {
                          if (err2) {
                              console.error('[users/spendCurrency]', 'error inserting transaction:', err2);
                              res.end(errorJson('database error', 105));
                          } else {
                              // update user collection
                              usersCollection.update({'uid' : id}, {'hardCurrency' : transaction.newAmount}, function(err3, result3) {
                                 if (err3) {
                                     console.error('[users/spendCurrency]', 'error updating user:', err3);
                                     res.end(errorJson('database error', 105));
                                 } else {
                                     res.end(JSON.stringify({'currency' : transaction.newAmount}));
                                 }
                              });
                          }
                       });
                   }
               }
            });
        }
    });
    
    // endpoint to return all un-seen transactions for an user
    app.post('/users/getUnseenTransactions', function(req, res) {
       var id = req.body['id']||undefined
       
       if (!id) {
            console.error('[users/getUnseenTransactions]', 'missing parameter(s)');
            res.writeHead(400);
            res.end(errorJson('missing parameter(s)', 104));
       } else {
            transactionCollection.find({'uid' : id, 'seen' : false}, function(err, result) {
               if (err) {
                    console.error('[users/getUnseenTransactions]', 'error getting transactions', err);
                    res.writeHead(200);
                    res.end(errorJson('database error', 105));
               } else if (!result) {
                    res.writeHead(200);
                    res.end(JSON.stringify({'transactions' : []}));
               } else {
                    // update all of these to have been seen
                    transactionCollection.update({'uid' : id, 'seen' : false}, {'seen' : true}, function(err2, result2) {
                        if (err2) console.error('[users/getUnseenTransactions]', 'error updating transactions:', err2);
                        res.writeHead(200);
                        res.end(JSON.stringify({'transactions' : result}));
                    });
               }
            });
       }
    });
    
    app.post('/users/authMachine', function(req, res) {
       var uid = req.body['machine']||undefined;
       
       if (!uid) {
           console.error('[/users/authMachine]', 'called with missing parameter(s)');
           res.writeHead(400);
           res.end(errorJson('missing parameter(s)', 104));
       } else {
           console.log('[/users/authMachine]', 'authing with uid: ' + uid);
           res.writeHead(200);
           var serviceResults = [];
           var cycle = function(index) {
               if (index >= userServices.length) {
                   var user = {
                       'uid'        : uid
                   };
                    for (var i in serviceResults) {
                        var sresult = serviceResults[i];
                        var name = sresult.name.toString();
                        delete sresult.name;
                        user[name] = sresult;
                    }
                    console.log('[/users/authMachine]', 'updating user');
                    usersCollection.update({'uid' : uid}, user, {upsert : true}, function(err, result) {
                        if (err) {
                            console.error('[/users/authMachine]', 'error updating user:', err);
                            res.end(errorJson('database error', 105));
                        } else {
                            getSession(user, function(user) {
                                // 200 response
                                res.end(JSON.stringify(user));
                            });
                        }
                    });
               } else {
                    var service = userServices[index];
                    if (service.AuthWithMachine) {
                        console.log('[/users/authMachine]', 'running service:', service.name);
                        service.AuthWithMachine(uid, function(err, ret) {
                          if (!err) {
                               var result = {
                                 name       : service.name,
                                 username   : ret.username,
                                 session    : ret.token,
                                 uid        : ret.uid
                               };
                               if (ret.expiration) result.expires = ret.expiration;
                               serviceResults.push(result);
                               cycle(index + 1);
                          } else {
                               res.end(errorJson('service issue', 105));
                          }
                        });
                    }
               }
           };
           cycle(0);
       }
    });
    
    // need a auth-with-facebook endpoint
    app.post('/users/authWithFacebook', function(req, res) {
       var accessToken  = req.body['accessToken']||undefined;
       var fbid         = req.body['fbid']||undefined;
       var expiration   = req.body['expiration']||undefined;
       
       if (!accessToken || !fbid || !expiration) {
        console.error('[/authWithFacebook]', 'called with missing param(s)');
        // write back 400
        res.writeHead(400);
        res.end(JSON.stringify({'error' : 'mising prameters'}));
       } else {
           var serviceResults = [];
           var cycle = function(index) {
               if (index >= userServices.length) {
                    // finished logging into the various services via facebook...
                    // store info into mongo user table
                    var user = {
                        'uid'          : fbid,
                        'accessToken'   : accessToken
                    };
                    for (var i in serviceResults) {
                        var sresult = serviceResults[i];
                        var name = sresult.name.toString();
                        delete sresult.name;
                        user[name] = sresult;
                    }
                    usersCollection.update({'uid' : fbid}, user, {upsert : true}, function(err, result) {
                        if (err) {
                         console.error('[/authWithFacebook]', 'error upserting into mongo:', err);
                        }
                        getSession(user, function(user) {
                            // 200 response
                            res.writeHead(200);
                            res.end(JSON.stringify(user));
                        });
                    });
                } else {
                    var service = userServices[index];
                    if (service.AuthWithFacebook) {
                        service.AuthWithFacebook(accessToken, fbid, expiration, function(err, ret) {
                          if (!err) {
                           var result = {
                             name       : service.name,
                             username   : ret.username,
                             session    : ret.token,
                             uid        : ret.uid
                           };
                           if (ret.expiration) result.expires = ret.expiration;
                           console.log('adding to service results:');
                           console.dir(result);
                           serviceResults.push(result);
                           cycle(index + 1);
                          } else {
                           // exit with a 400
                           res.writeHead(400);
                           res.end(JSON.stringify({'error' : 'failed to login to: ' + service.name}));
                          }
                        });
                    } else {
                        cycle(index + 1);   
                    }
               }
           };
           cycle(0);
       }
    });

    app.post('/createUser', function(req, res) 
    {
       console.log('createUser');
       
       var username = req.body.username;
       var password = req.body.password;
       
       var postData = 
       {
           username     : username,
           password     : password
       };
       
       var options = 
       {
           hostname     : 'api.parse.com',
           path         : '/1/users',
           method       : 'POST',
           headers      : {
               'X-Parse-Application-Id'     : config.parse.applicationId,
               'X-Parse-REST-API-Key'       : config.parse.restApiKey,
               'Content-Type'               : 'application/json'
           }
       };
       
       httpUtils.httpsRequest(options, postData, function(reqResponse, error)
       {
            if(error)
                res.send(error);
            else
                res.send(reqResponse);
       });
    });
    
    app.post('/authUser', function(req,res)
    {
       console.log('authUser');
       
       var username = req.body.username;
       var password = req.body.password;
       
       var options = 
       {
           hostname     : 'api.parse.com',
           path         : '/1/login?username='+username+'&password='+password,
           method       : 'GET',
           headers      : {
               'X-Parse-Application-Id'     : config.parse.applicationId,
               'X-Parse-REST-API-Key'       : config.parse.restApiKey,
               'Content-Type'               : 'application/json'
           }
       };
       
       console.log(options);
       
       httpUtils.httpsRequest(options, function(reqResponse, error)
       {
            if(error)
                res.send(error);
            else
                res.send(reqResponse);
       });
    });

    app.post('/registerPushNotification', function(req, res) 
    {
        console.log('registerPushNotification');
        
        var deviceType = req.body.deviceType;
        var deviceToken = req.body.deviceToken;
        var username = req.body.username;
        
        var postData = 
        {
            deviceToken : deviceToken,
            deviceType  : deviceType,
            channels    : [""],
            username    : username
        };
        
        var options = 
        {
            hostname     : 'api.parse.com',
            path         : '/1/installations',
            method       : 'POST',
            headers      : {
               'X-Parse-Application-Id'     : config.parse.applicationId,
               'X-Parse-REST-API-Key'       : config.parse.restApiKey,
               'Content-Type'               : 'application/json'
            }
        };
        
        httpUtils.httpsRequest(options, postData, function(reqResponse, error)
        {
            if(error)
                res.send(error);
            else
                res.send(reqResponse);
        });
        
    })
    
    // not sure any of the below are necessary? if so move into ParseClient
    // app.post('/addToRoom', function(req, res) 
    // {
    //     console.log('addToRoom');
        
    //     var username = req.body.username;
    //     var room = req.body.room;
        
    //     var installationReqOptions = 
    //     {
    //         hostname     : 'api.parse.com',
    //         path         : '/1/installations?where='+JSON.stringify( {username:username} ),
    //         method       : 'GET',
    //         headers      : {
    //           'X-Parse-Application-Id'     : config.parse.applicationId,
    //           'X-Parse-Master-Key'         : config.parse.masterKey,
    //           'Content-Type'               : 'application/json'
    //         }
    //     };
        
    //     httpUtils.httpsRequest(installationReqOptions, function(installationReq, error) 
    //     {
    //         if(error)
    //             res.send(error);
    //         else
    //         {
    //             // console.log(installationReq);
             
    //             if(installationReq.length == 0)
    //             {
    //                 res.send(JSON.stringify({error:'query found no results for username : ' + username}));
    //                 return;
    //             }
                
    //             var installationReqJSON = JSON.parse(installationReq).results;
                
    //             var installation = installationReqJSON[0];
    //             var channels = installation.channels||[];
                
    //             if(channels.indexOf(room) != -1)
    //             {
    //                 res.send(JSON.stringify({error:'user already registered to room : ' + room}));
    //                 return;
    //             }
                
    //             channels.push(room);
                
    //             var putData = 
    //             {
    //                 channels    : channels
    //             };
                
    //             var updateInstallationReqOptions = 
    //             {
    //                 hostname     : 'api.parse.com',
    //                 path         : '/1/installations/'+installation.objectId,
    //                 method       : 'PUT',
    //                 headers      : {
    //                     'X-Parse-Application-Id'     : config.parse.applicationId,
    //                     'X-Parse-REST-API-Key'       : config.parse.restApiKey,
    //                     'Content-Type'               : 'application/json'
    //                 }
    //             };
                
    //             httpUtils.httpsRequest(updateInstallationReqOptions, putData, function(reqResponse, error) 
    //             {
    //                 if(error)
    //                     res.send(error);
    //                 else
    //                     res.send(reqResponse);
    //             });
    //         }
    //     })
    // });

    // app.post('/removeFromRoom', function(req, res) 
    // {
    //     console.log('removeFromRoom');
        
    //     var username = req.body.username;
    //     var room = req.body.room;
        
    //     var installationReqOptions = 
    //     {
    //         hostname     : 'api.parse.com',
    //         path         : '/1/installations?where='+JSON.stringify( {username:username} ),
    //         method       : 'GET',
    //         headers      : {
    //           'X-Parse-Application-Id'     : config.parse.applicationId,
    //           'X-Parse-Master-Key'         : config.parse.masterKey,
    //           'Content-Type'               : 'application/json'
    //         }
    //     };
        
    //     httpUtils.httpsRequest(installationReqOptions, function(installationReq, error) 
    //     {
    //         if(error)
    //             res.send(error);
    //         else
    //         {
    //             // console.log(installationReq);
             
    //             if(installationReq.length == 0)
    //             {
    //                 res.send(JSON.stringify({error:'query found no results for username : ' + username}));
    //                 return;
    //             }
                
    //             var installationReqJSON = JSON.parse(installationReq).results;
                
    //             var installation = installationReqJSON[0];
    //             var channels = installation.channels||[];
                
    //             var indexOfRoom = _.indexOf(channels,room);
                
    //             if(indexOfRoom != -1)
    //             {
    //                 channels.splice(indexOfRoom, 1);    
    //             }
                
    //             var putData = 
    //             {
    //                 channels    : channels
    //             };
                
    //             var updateInstallationReqOptions = 
    //             {
    //                 hostname     : 'api.parse.com',
    //                 path         : '/1/installations/'+installation.objectId,
    //                 method       : 'PUT',
    //                 headers      : {
    //                     'X-Parse-Application-Id'     : config.parse.applicationId,
    //                     'X-Parse-REST-API-Key'       : config.parse.restApiKey,
    //                     'Content-Type'               : 'application/json'
    //                 }
    //             };
                
    //             httpUtils.httpsRequest(updateInstallationReqOptions, putData, function(reqResponse, error) 
    //             {
    //                 if(error)
    //                     res.send(error);
    //                 else
    //                     res.send(reqResponse);
    //             });
    //         }
    //     })
    // });
    
    
    // app.post('/exitAllRooms', function(req, res) 
    // {
    //     console.log('exitAllRooms');
        
    //     var username = req.body.username;
        
    //     var installationReqOptions = 
    //     {
    //         hostname     : 'api.parse.com',
    //         path         : '/1/installations?where='+JSON.stringify( {username:username} ),
    //         method       : 'GET',
    //         headers      : {
    //           'X-Parse-Application-Id'     : config.parse.applicationId,
    //           'X-Parse-Master-Key'         : config.parse.masterKey,
    //           'Content-Type'               : 'application/json'
    //         }
    //     };
        
    //     httpUtils.httpsRequest(installationReqOptions, function(installationReq, error) 
    //     {
    //         if(error)
    //             res.send(error);
    //         else
    //         {
    //             // console.log(installationReq);
             
    //             if(installationReq.length == 0)
    //             {
    //                 res.send(JSON.stringify({error:'query found no results for username : ' + username}));
    //                 return;
    //             }
                
    //             var installationReqJSON = JSON.parse(installationReq).results;
                
    //             var installation = installationReqJSON[0];
                
    //             var putData = 
    //             {
    //                 channels    : [""]
    //             };
                
    //             var updateInstallationReqOptions = 
    //             {
    //                 hostname     : 'api.parse.com',
    //                 path         : '/1/installations/'+installation.objectId,
    //                 method       : 'PUT',
    //                 headers      : {
    //                     'X-Parse-Application-Id'     : config.parse.applicationId,
    //                     'X-Parse-REST-API-Key'       : config.parse.restApiKey,
    //                     'Content-Type'               : 'application/json'
    //                 }
    //             };
                
    //             httpUtils.httpsRequest(updateInstallationReqOptions, putData, function(reqResponse, error) 
    //             {
    //                 if(error)
    //                     res.send(error);
    //                 else
    //                     res.send(reqResponse);
    //             });
    //         }
    //     })
    // });
}