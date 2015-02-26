var https       = require('https');
var URL         = require('url');
var querystring = require('querystring');

var agents = {};
function getAgent(options) {
  var id = options.host + ':' + options.port;
  if (agents[id]) {
    return agents[id];
  }
  
  var agent = new https.Agent(options);
  agent.maxSocekts = 25;
  agents[id] = agent;
  return agent;
};

function doRequest(method, url, callback) {
  var parsedUrl = URL.parse(url, true);
  
  var options = {
    host     : parsedUrl.host,
    port     : 443,
    path     : parsedUrl.pathname + "?" + querystring.stringify(parsedUrl.query),
    method   : method,
    headers  : {
      'Connection'  : 'keep-alive'
    }
  };
  
  if (method == 'POST') {
    options.headers['Content-Length'] = '0';
  }
  
  options.agent = getAgent(options);
  
  var outerCallback = callback;
  callback = function(err, result) {
    if (outerCallback) {
      outerCallback(err, result);
      outerCallback = null;
    }
  }
  
  var attempts = 0;
  
  var retry = function(err) {
    if (outerCallback) {
      attempts++;
      if (attempts <= 3) {
        tryRequest();
      } else {
        callback(err || 'facebook call timed out');
      }
    }
  };
  
  var tryRequest = function() {
    var req = https.request(options, function(res) {
      res.setEncoding('utf8');
      
      var result = '';
      res.on('data', function(data) {
        result += data;
      });
      
      res.on('end', function() {
        if (res.statusCode >= 300) {
          try {
            var data = JSON.parse(result);
            if (data.error) {
              if (data.error.type == 'OAuthException') {
                return retry(data.error);
              }
              // else
              return callback(data.error);
            }
          } catch (err) {
            console.log('non-200:', res.statusCode, result);
            retry({statusCode : res.statusCode, data: result});
          }
        } else {
          var parsedResult = null;
          try {
            parsedResult = JSON.parse(result);
          } catch (err) { }
          
          if (!parsedResult) {
            console.log('[facebook/doRequest]', 'error parsing result', result);
            callback('bad result');
          } else if (parsedResult.error_code) {
            console.log('[facebook/doRequest]', 'error from facebook', parsedResult.error_code);
            callback(parsedResult.error_code);
          } else {
            callback(null, parsedResult);
          }
        }
      });
      
    });
    
    req.on('error', function(err) {
      return retry(err);
    });
    
    req.end();
    
    setTimeout(function() {
      retry('timeout');
    }, 5000);
    
  };
  
  tryRequest();
  
};

module.exports = function (config) {
  
  var FacebookClient = {};
  
  FacebookClient.graph_url = "https://graph.facebook.com";
  FacebookClient.app_id = config.facebook.app_id;
  FacebookClient.secret = config.facebook.secret_key;
  
  FacebookClient.graphRequest = function (method, path, params, callback) {
    if (!params) params = {};
    params["access_token"] = this.secret;
    doRequest(method, this.graph_url + path + "?" + querystring.stringify(params), callback);
  };
  
  return FacebookClient;
};