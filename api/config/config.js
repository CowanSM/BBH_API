var fs = require("fs");
var _ = require('underscore');
var async = require('async');
var http = require('http');
var https = require('https');
var path = require('path');

exports = module.exports = function(config, options)
{
    //vedad - default configuration
    //example
    config.test = true;
    
    //vedad - load the proper configuration for the current environment
    var configFile = 'development.json';
    if(process.env.NODE_ENV == 'production')
    {
        configFile = 'production.json';
    }
    
    var configJson = fs.readFileSync(require('path').join(__dirname, configFile), {encoding:'utf8'});
    
    // console.log('configJson : ' + configJson);
    
    if(!_.isObject(configJson))
        configJson = JSON.parse(configJson);
    
    // console.log('old config : ' + JSON.stringify(config));
    config = _.extend(config, configJson);
    // console.log('new config : ' + JSON.stringify(config));
    
    return config;
}