var http = require('http');
var https = require('https');
var _ = require("underscore");

var httpUtils = require("../utilities/httpUtils");

exports = module.exports = function(config, options)
{
    var app = config.app;
    
    app.post('/sendParseNotificationToRoom', function(req,res)
    {
       console.log('sendParseNotificationToRoom');
       
       var room = req.body.room;
       var message = req.body.message;
       var title = req.body.title;
       var tickTime = req.body.tickTime||null;
       var deviceType = req.body.deviceType||null;
       
       var options = 
       {
           hostname     : 'api.parse.com',
           path         : '/1/push',
           method       : 'POST',
           headers      : {
               'X-Parse-Application-Id'     : config.parse.applicationId,
               'X-Parse-REST-API-Key'       : config.parse.restApiKey,
               'Content-Type'               : 'application/json'
           }
       };
       
       var postData = 
       {
           channels : [room],
           data     : {
               alert    : message,
                sound   : 'default',
           }
       };
       if(tickTime)
            postData.push_time = parseInt( tickTime );
        if(deviceType)
            postData.deviceType = deviceType;
       
       httpUtils.httpsRequest(options, postData, function(reqResponse, error)
       {
            if(error)
                res.send(error);
            else
                res.send(reqResponse);
       });
    });
}