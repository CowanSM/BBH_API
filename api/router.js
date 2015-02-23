 var fs = require("fs");
var _ = require('underscore');
var async = require('async');
var http = require('http');
var https = require('https');
var path = require('path');

exports = module.exports = function(config, options)
 {
    var app = config.app;
 
    //vedad - load our config
    config = require('./config/config')(config);
 
    //Vedad - include all of our essentials
    var essentialPath = require('path').join(__dirname, 'essential');
    fs.readdirSync(essentialPath).forEach(function(file)
    {
        // console.log('requiring : ' + file);
        require('./essential/'+file)(config); 
    });
    
    //Vedad - include all of our custom routes
    var customRoutes = require('path').join(__dirname, 'routes');
    if(fs.existsSync(customRoutes))
    {
        fs.readdirSync(customRoutes).forEach(function(file)
        {
            // console.log('requiring : ' + file);
            require('./routes/'+file)(config); 
        });
    }
 }