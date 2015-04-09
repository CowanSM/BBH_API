var http = require('http');
var https = require('https');
var _ = require("underscore");

exports = module.exports = function(config, options)
{
    var app = config.app;
    
    var userServices = config.user.services||[];
    
    // temporary until V checks in some stuff:
    //userServices.push(require('../utilities/parse/parse')(config));
    /////////////////////////////////////////////////////////////// 
    
    var httpUtils = config.httpUtils;
    
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = config.baseModel;
    var usersCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    
    // function for tieing-in session info
    var getSession = function(user, callback) 
    {
        //Vedad - add shit here
        //function to "register" user. needs to return api server address, expiry token, 
        
        var data = {
            uid     : user.uid
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
    
    app.publicpost('/users/authMachine', function(req, res) {
       var uid = req.param('machine', undefined);
       
       if (!uid) {
           console.error('missing parameter(s) ' + uid);
           res.error('missing parameters', {'code' : 104});
       } else {
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
                    user.dev = true;
                    usersCollection.update({'uid' : uid}, user, {upsert : true}, function(err, result) {
                        if (err) {
                            console.error('[/users/authMachine]', 'error updating user:', err);
                            res.error('database error', {'code' : 105});
                        } else {
                            getSession(user, function(session) {
                                // 200 response
                                res.end(JSON.stringify({'user' : user, 'session' : session.session}));
                            });
                        }
                    });
               } else {
                    var service = userServices[index];
                    if (service.AuthWithMachine) {
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
                               console.error('unable to auth with service: ' + service.name);
                               res.error('service issue', {'code' : 105});
                          }
                        });
                    }
               }
           };
           cycle(0);
       }
    });
    
    // need a auth-with-facebook endpoint
    app.publicpost('/users/authWithFacebook', function(req, res) {
        var accessToken = req.param('accessToken', undefined);
        var fbid        = req.param('fbid', undefined);
        var expiration  = req.param('expiration', undefined);
        
        if (!accessToken || !fbid || !expiration) {
            console.error('missing parameters: ' + fbid + ' ' + accessToken + ' ' + expiration);
            res.error('missing parameters', {'code' : 104});
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
                            console.error('error upserting user into mongo: ' + err);
                            res.error('database error', {'code' : 105});
                        } else {
                            getSession(user, function(session) {
                                res.end(JSON.stringify({'user' : user, 'session' : session.session}));
                            });
                        }
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
                               serviceResults.push(result);
                               cycle(index + 1);
                          } else {
                              console.error('failed to login to ' + service.name);
                              res.error('failed to login to: ' + service.name, {'code' : 105});
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
    
    app.post('/user/save', function(req, res) {
        var uid = req.session.uid||undefined;
        var data = req.param('data', undefined);
        if (uid && data) {
            // it is safe to assume that the user is valid at this point
            // below may be uneccessary, but it does serve as a form of user validation
            usersCollection.find({'uid' : uid}, function(err, result) {
                if (err || !result) {
                    console.error('[user_data/save]', 'error getting user from table:', err||'no user was found with id');
                    res.error('database error', {'code' : 105});
                } else {
                    // save the data
                    usersCollection.update({'uid' : uid}, {'data': data}, function(err, result) {
                       if (err) {
                           console.error('error saving the data: ' + err);
                           res.error('database error', {'code' : 105});
                       } else {
                           res.end(JSON.stringify({'success' : true}));
                       }
                    });
                }
            });
        } else {
            res.error('missing parameter(s)', {'code' : 104});
        }
    });
    
    app.post('/user/load', function(req, res) {
        var uid = req.session.uid||undefined;
        if (uid) {
            usersCollection.find({'uid' : uid}, function(err, result) {
               if (err || !result) {
                    console.error('error getting user from collection: ' + err||'no user with fbid');
                    res.error('database error', {'code' : 105});
               } else {
                   var user = result[0];
                   res.end(JSON.stringify({'data' : user.data}));
               }
            });
        } else {
            res.error('missing parameter(s)', {'code' : 104});
        }
    });

    app.publicpost('/createUser', function(req, res) 
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
    
    app.publicpost('/authUser', function(req,res)
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

    app.publicpost('/registerPushNotification', function(req, res) 
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