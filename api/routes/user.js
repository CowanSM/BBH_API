var http = require('http');
var https = require('https');
var _ = require("underscore");

var httpUtils = require("../utilities/httpUtils");

exports = module.exports = function(config, options)
{
    var app = config.app;
    
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

    app.post('/addToRoom', function(req, res) 
    {
        console.log('addToRoom');
        
        var username = req.body.username;
        var room = req.body.room;
        
        var installationReqOptions = 
        {
            hostname     : 'api.parse.com',
            path         : '/1/installations?where='+JSON.stringify( {username:username} ),
            method       : 'GET',
            headers      : {
               'X-Parse-Application-Id'     : config.parse.applicationId,
               'X-Parse-Master-Key'         : config.parse.masterKey,
               'Content-Type'               : 'application/json'
            }
        };
        
        httpUtils.httpsRequest(installationReqOptions, function(installationReq, error) 
        {
            if(error)
                res.send(error);
            else
            {
                // console.log(installationReq);
             
                if(installationReq.length == 0)
                {
                    res.send(JSON.stringify({error:'query found no results for username : ' + username}));
                    return;
                }
                
                var installationReqJSON = JSON.parse(installationReq).results;
                
                var installation = installationReqJSON[0];
                var channels = installation.channels||[];
                
                if(channels.indexOf(room) != -1)
                {
                    res.send(JSON.stringify({error:'user already registered to room : ' + room}));
                    return;
                }
                
                channels.push(room);
                
                var putData = 
                {
                    channels    : channels
                };
                
                var updateInstallationReqOptions = 
                {
                    hostname     : 'api.parse.com',
                    path         : '/1/installations/'+installation.objectId,
                    method       : 'PUT',
                    headers      : {
                        'X-Parse-Application-Id'     : config.parse.applicationId,
                        'X-Parse-REST-API-Key'       : config.parse.restApiKey,
                        'Content-Type'               : 'application/json'
                    }
                };
                
                httpUtils.httpsRequest(updateInstallationReqOptions, putData, function(reqResponse, error) 
                {
                    if(error)
                        res.send(error);
                    else
                        res.send(reqResponse);
                });
            }
        })
    });

    app.post('/removeFromRoom', function(req, res) 
    {
        console.log('removeFromRoom');
        
        var username = req.body.username;
        var room = req.body.room;
        
        var installationReqOptions = 
        {
            hostname     : 'api.parse.com',
            path         : '/1/installations?where='+JSON.stringify( {username:username} ),
            method       : 'GET',
            headers      : {
               'X-Parse-Application-Id'     : config.parse.applicationId,
               'X-Parse-Master-Key'         : config.parse.masterKey,
               'Content-Type'               : 'application/json'
            }
        };
        
        httpUtils.httpsRequest(installationReqOptions, function(installationReq, error) 
        {
            if(error)
                res.send(error);
            else
            {
                // console.log(installationReq);
             
                if(installationReq.length == 0)
                {
                    res.send(JSON.stringify({error:'query found no results for username : ' + username}));
                    return;
                }
                
                var installationReqJSON = JSON.parse(installationReq).results;
                
                var installation = installationReqJSON[0];
                var channels = installation.channels||[];
                
                var indexOfRoom = _.indexOf(channels,room);
                
                if(indexOfRoom != -1)
                {
                    channels.splice(indexOfRoom, 1);    
                }
                
                var putData = 
                {
                    channels    : channels
                };
                
                var updateInstallationReqOptions = 
                {
                    hostname     : 'api.parse.com',
                    path         : '/1/installations/'+installation.objectId,
                    method       : 'PUT',
                    headers      : {
                        'X-Parse-Application-Id'     : config.parse.applicationId,
                        'X-Parse-REST-API-Key'       : config.parse.restApiKey,
                        'Content-Type'               : 'application/json'
                    }
                };
                
                httpUtils.httpsRequest(updateInstallationReqOptions, putData, function(reqResponse, error) 
                {
                    if(error)
                        res.send(error);
                    else
                        res.send(reqResponse);
                });
            }
        })
    });
    
    
    app.post('/exitAllRooms', function(req, res) 
    {
        console.log('exitAllRooms');
        
        var username = req.body.username;
        
        var installationReqOptions = 
        {
            hostname     : 'api.parse.com',
            path         : '/1/installations?where='+JSON.stringify( {username:username} ),
            method       : 'GET',
            headers      : {
               'X-Parse-Application-Id'     : config.parse.applicationId,
               'X-Parse-Master-Key'         : config.parse.masterKey,
               'Content-Type'               : 'application/json'
            }
        };
        
        httpUtils.httpsRequest(installationReqOptions, function(installationReq, error) 
        {
            if(error)
                res.send(error);
            else
            {
                // console.log(installationReq);
             
                if(installationReq.length == 0)
                {
                    res.send(JSON.stringify({error:'query found no results for username : ' + username}));
                    return;
                }
                
                var installationReqJSON = JSON.parse(installationReq).results;
                
                var installation = installationReqJSON[0];
                
                var putData = 
                {
                    channels    : [""]
                };
                
                var updateInstallationReqOptions = 
                {
                    hostname     : 'api.parse.com',
                    path         : '/1/installations/'+installation.objectId,
                    method       : 'PUT',
                    headers      : {
                        'X-Parse-Application-Id'     : config.parse.applicationId,
                        'X-Parse-REST-API-Key'       : config.parse.restApiKey,
                        'Content-Type'               : 'application/json'
                    }
                };
                
                httpUtils.httpsRequest(updateInstallationReqOptions, putData, function(reqResponse, error) 
                {
                    if(error)
                        res.send(error);
                    else
                        res.send(reqResponse);
                });
            }
        })
    });
}