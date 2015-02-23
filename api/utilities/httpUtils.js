var _ = require('underscore');
var async = require('async');
var http = require('http');
var https = require('https');

module.exports = 
{
    httpRequest: function(options, postData, cb) 
    {
        if(arguments.length == 2)
            sendRequest(http, options, postData);
        else
            sendRequest(http, options, postData, cb);
    },

    httpsRequest: function(options, postData, cb) 
    {
        if(arguments.length == 2)
            sendRequest(https, options, postData);
        else
            sendRequest(https, options, postData, cb);
    },
};

function sendRequest(module, options, postData, cb)
{
    if (arguments.length == 3)
        {
            cb = postData;
            postData = null;
        }
        
        var req = module.request(options, function(res) 
        {
            // console.log('STATUS: ' + res.statusCode);
            // console.log('HEADERS: ' + JSON.stringify(res.headers));
            res.setEncoding('utf8');

            var body = '';

            res.on('data', function(chunk) 
            {
                // console.log('data : ', chunk);
                body += chunk;
            });

            res.on('end', function() 
            {
                // console.log('end');

                if (_.isObject(body))
                    cb(JSON.stringify(body));
                else
                    cb(body);
            });
        });

        req.on('error', function(e) 
        {
            // console.log(e);

            cb(null, e);
        });

        if (postData)
            req.write(JSON.stringify(postData));
        req.end();
}