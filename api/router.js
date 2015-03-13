
module.exports = function(config) {
    
    // Load user services into config structure
    config.user = {
      services  : []  
    };
    
    config.user.services.push(require(__dirname + '/utilities/parse/parse.js')(config));
    
    
    return config;
};