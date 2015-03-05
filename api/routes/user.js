var http = require('http');
var https = require('https');
var _ = require("underscore");

exports = module.exports = function(config, options)
{
    var app = config.app;
    
    var userServices = config.services||[];
    
    // temporary until V checks in some stuff:
    userServices.push(require('../utilities/parse/parse')(config));
    /////////////////////////////////////////////////////////////// 
    
    var httpUtils = config.httpUtils;
    
    // mongo stuff
    var prefix = config.mongo.prefix||'';
    var mongoModel = __dirname + '/../../api_engine/base/model';
    var usersCollection = require(mongoModel)(prefix + 'users', function(){}, config, options);
    
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
                        'fbid'          : fbid,
                        'accessToken'   : accessToken
                    };
                    for (var i in serviceResults) {
                        var sresult = serviceResults[i];
                        var name = sresult.name;
                        delete sresult.name;
                        user[name] = sresult;
                    }
                    console.log('upserting user:');
                    console.dir(user);
                    usersCollection.update({'fbid' : fbid}, user, {upsert : true}, function(err, result) {
                        if (err) {
                         console.error('[/authWithFacebook]', 'error upserting into mongo:', err);
                        }
                        // 200 response
                        res.writeHead(200);
                        res.end('ok');
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