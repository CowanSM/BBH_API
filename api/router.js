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
    
    var utilsPath = require('path').join(__dirname, 'utilities');
    fs.readdirSync(utilsPath).forEach(function(file)
    {
        // console.log('requiring : ' + file);
        // require('./essential/'+file)(config); 
        
        var basename = path.basename('./utilities/'+file, path.extname(file));
        
        config[basename] = require('./utilities/'+file); 
    });
    
    //Vedad - include all of our custom routes
    var customRoutes = path.join(__dirname, 'routes');
    if(fs.existsSync(customRoutes))
    {
        fs.readdirSync(customRoutes).forEach(function(file)
        {
            requireFilesFromDirectory(path.join(customRoutes, file));
        });
    }
    
    function requireFilesFromDirectory(dirPath)
    {
        // console.log('requireFilesFromDirectory : ', dirPath);
        
        if(fs.lstatSync(dirPath).isDirectory())
        {
            // console.log('is directory, going deeper');
            fs.readdirSync(dirPath).forEach(function(file)
            {   
                var currPath = path.join(dirPath, file);
                
                if(fs.lstatSync(currPath).isDirectory())
                {
                    // console.log('is directory, going deeper');
                    requireFilesFromDirectory(currPath);
                }
                else
                {
                    // console.log('requiring file : ', currPath);
                    require(currPath)(config); 
                }
            });
        }
        else
        {
            // console.log('requiring file : ', dirPath);
            require(dirPath)(config); 
        }
        
        return;
    };
 }