var http = require('http');
var https = require('https');
var _ = require("underscore");

exports = module.exports = function(config, options)
{
    var app = config.app;
    
    var httpUtils = config.httpUtils;

    app.get('/test', function(req, res) 
    {
        console.log('test');
        
        res.send("test response from server");
    });
    
    app.get('/test/test2', function(req, res) 
    {
        console.log('/test/test2');
        
        res.send("/test/test2 response from server");
    });
    
    app.all('/test/test3', function(req, res) 
    {
        console.log('/test/test3');
        
        res.send("/test/test3 response from server");
    });
}