module.exports = function(config) {
    
    // Load user services into config structure
    config.user = {
      services  : []  
    };
    
    //Vedad - I hard coded this in the engine router, need to figure out what to do here....
    // config.user.services.push(require(__dirname + '/utilities/parse/parse.js')(config))
    config.tunables = require(__dirname + '/utilities/xlsParams.js')(config);
    
    
    return config;
};

