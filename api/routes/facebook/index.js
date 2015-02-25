var Facebook = require('../../utilities/facebook/facebook');
var fs       = require('fs');

exports = module.exports = function(config, options) {
    var app = config.app;

    var getPaymentsInfo = function(entries) {
        // set up recursive cycle method
        var cycle = function(index) {
            if (index >= entries.length) {
                console.log('[facebook/getPaymentsInfo]', 'finished processing payments');
            }
            else {
                Facebook.graphRequest('GET', '/' + entries[index].id, null, function(err, result) {
                    if (err || !result) {
                        console.error('[facebook/getPaymentsInfo]', 'error with facebook request', err||'no result');
                        // continue cycle
                        cycle(index + 1);
                    } else {
                        // store object in db
                        result._id = result.id;
                        delete result.id;
                        // do update here...
                        
                        cycle(index + 1);
                    }
                });
            }
        };
        cycle(0);
    };
    
    app.all("/facebook/payobject/:id", function(req, res) {
       // normally perform lookup on the id provided and return that rendered, but for testing just render the template
       
       var data = {
           title    : "Test Currency",
           description  : "test currency for fb testing",
           url      : "", // url of this goes here...
           plural   : "Test Currencies",
           usd      : "1.99",
           gbp      : "0.80"
       };
       
       return res.render(fs.readFileSync('../../templates/object_payment.ejs', 'utf8'), data);
    });

    app.all("/facebook/payments/:mode/:challenge/:token", function(req, res) {

        var fb_mode = req.query['hub.mode'] || 0;
        
        console.log("[facebook/payments]", "in endpoint");

        // set response values
        var statusCode = 200;
        var responseText = "ok";

        if (!fb_mode) {
            var jsonBody = JSON.parse(req.rawBody);

            if (jsonBody.object && jsonBody.object == "payments") {
                for (var i in jsonBody.entry) {
                    // insert into real-time updates collection
                }
                
                // get info from fb for each entry
                getPaymentsInfo(jsonBody.entry);
            } else {
                console.error('[facebook/payments]', 'unknown request', jsonBody);
                statusCode = 400;
                responseText = 'unknown request';
            }
        }
        else {
            if (fb_mode == "subscribe") {
                // check the verify token
				var verify = req.query['hub.verify_token']||'';
                if (verify != config.facebook.verification_token) {
                    statusCode = 400;
                    responseText = "invalid verification token sent";
                }
                else {
                    responseText = req.query['hub.challenge'] || "not-ok";
                }
            }
            else {
                console.log("[facebook/payments]", "unhandled fb mode", fb_mode);
                statusCode = 400;
                responseText = "not-ok";
            }
        }

        // send reply
        res.writeHead(statusCode, {"Content-Type": "text/plain"});
        res.end(responseText);
    });

}