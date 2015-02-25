var fs = require("fs");
var _ = require('underscore');
var async = require('async');
var http = require('http');
var https = require('https');
var path = require('path');

exports = module.exports = function(collectionName, config, options)
{
    var collection;
    
    var notificationsCollection = require(config.baseModel)(collectionName, 
        function(config)
        {
            collection = config.collection;
    
            // console.log('collection null ' + (collection == null));
        }, config, options);

    return notificationsCollection;  
}