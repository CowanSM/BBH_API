var Facebook = require('../../utilities/facebook/facebook');

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
        }
    };

    app.all("/payments", function(req, res) {

        var fb_mode = req.quer['hub.mode'] || 0;

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
        res.writeHead(statusCode);
        res.end(responseText);
    });

}