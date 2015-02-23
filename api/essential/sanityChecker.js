 var fs = require("fs");
 var path = require("path");
 
 exports = module.exports = function(config, options)
 {
     
    if(process.env.cloud9)
        return;
        
     //Vedad - check all of our models
    var modelsPath = path.join(__dirname, '../models');
    fs.readdirSync(modelsPath).forEach(function(file)
    {
        // console.log('requiring : ' + file);
        require(modelsPath+'/'+file)('testCollection', config); 
    });
 }