 
 exports = module.exports = function(config, options)
 {
    var app = config.app;
 
    app.all('/crossdomain.xml', function(req,res)
    {
        log('returning crossdomain');
       
        res.end('<?xml version="1.0"?><cross-domain-policy><allow-access-from domain="*"/></cross-domain-policy>');
    });
 }