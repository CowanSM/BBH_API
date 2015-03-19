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

function doRequest(method, url, appid, restkey, form, callback) {
  var parsedUrl = URL.parse(url, true);
  
  if (!callback) {
   callback = form;
   form = null;
  }
  
  var options = {
    host     : parsedUrl.host,
    port     : parsedUrl.port||443,
    path     : parsedUrl.pathname + "?" + querystring.stringify(parsedUrl.query),
    method   : method,
    headers  : {
      'Connection'                 : 'keep-alive',
      'X-Parse-Application-Id'     : appid,
      'X-Parse-REST-API-Key'       : restkey,
    }
  };
  
  if (method == 'POST') {
    options.headers['Content-Length'] = JSON.stringify(form).length;
    options.headers['Content-Type'] = 'application/json';
  }
  
  console.log('sending req to parse, with options:');
  console.dir(options);
  
  if (form) {
   console.log('sending json:', JSON.stringify(form)); 
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
        callback(err || 'parse call timed out');
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
            console.log('[parse/doRequest]', 'error parsing result', result);
            callback('bad result');
          } else if (parsedResult.error_code) {
            console.log('[parse/doRequest]', 'error from parse', parsedResult.error_code);
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
    
    // write any post data
    if (form) {
     req.write(JSON.stringify(form));
    }
    
    req.end();
    
    setTimeout(function() {
      retry('timeout');
    }, 5000);
    
  };
  
  tryRequest();
  
};

module.exports = function(config) {
    var ParseClient = {};
    
    var app_id   = config.parse.applicationId;
    var rest_key = config.parse.restApiKey;
    var base_url = "https://api.parse.com/1/";
    
    ParseClient.name = 'Parse';
    
    ParseClient.AuthUser = function(username, password, callback) {
        if (!username || !password || !callback) {
         console.error('ParseClient.AuthUser called with missing parameters', username, password, callback);
         try {
             callback('invalid params');
         } catch (ex) {}
        } else {
            var url = base_url + 'login?username=' + username + '&password=' + password;
            doRequest('GET', url, app_id, rest_key, function(err, result) {
              if (err) {
                console.error('[parse/AuthUser]', 'error authorizing user:', err);
                callback(err, null);
              } else {
                callback(null, result);
              }
            });
        }
    };
    
    ParseClient.AuthWithMachine = function(uuid, callback) {
      if (!uuid) {
        console.error('ParseClient.AuthMachine called with missing parameter');
        if (callback) callback('invalid params');
      } else {
        var url = base_url + 'users';
        var form = {
          username    : uuid,
          password    : 'leviathandevelopment'
        };
        doRequest('POST', url, app_id, rest_key, form, function(err, result) {
          console.dir(err);
          console.dir(result);
          callback(err, result);
        });
      }
    };
    
    ParseClient.CreateUser = function(username, password, callback) {
      if (!username || !password || !callback) {
       console.error('[parse/CreateUser]', 'called with missing parameter(s)');
       try {
         callback('invalid params');
       } catch (ex) {}
      } else {
        var url = base_url + 'users';
        var form = {
           username     : username,
           password     : password
        };
        doRequest('POST', url, app_id, rest_key, form, function(err, result) {
          if (err) {
            console.error('[parse/CreateUser]', 'error from parse:', err);
            callback(err, null);
          } else {
            callback(null, err);
          }
        });
      }
    };
    
    ParseClient.AuthWithFacebook = function(accesstoken, fbid, expiration, callback) {
      if (!accesstoken || !fbid || !expiration || !callback) {
       console.error('[parse/AuthWithFacebook]', 'called with missing param(s)');
       try {
         callback('missing param(s)');
       } catch (ex) {}
      } else {
        var url = base_url + 'users';
        var form = {
          authData  : {
            facebook  : {
              'id'             : fbid,
              'access_token'   : accesstoken,
              'expiration_date': expiration
            }
          }
        };
        doRequest('POST', url, app_id, rest_key, form, function(err, result) {
          if (err) {
           console.error('[parse/AuthWithFacebook]', 'error from parse:', err);
           callback(err, null);
          } else {
            var retval = {
              username    : result.username,
              token       : result.sessionToken,
              uid         : result.objectId
            };
            callback(null, retval);
          }
        });
      }
    };
    
    ParseClient.RegisterPushNotification = function(deviceType, deviceToken, username, callback) {
      if (!deviceToken || !deviceType || !username || !callback) {
       console.error('[parse/RegisterPushNotification]', 'called with missing parameter(s)');
       try {
         callback('invalid params');
       } catch (ex) {}
      } else {
        var url = base_url + 'installations';
        var form = {
            deviceToken : deviceToken,
            deviceType  : deviceType,
            channels    : [""],
            username    : username
        };
        
        doRequest('POST', url, app_id, rest_key, form, function(err, result) {
          if (err) {
           console.error('[parse/RegisterPushNotification]', 'error from parse:', err);
           callback(err, null);
          } else {
            callback(null, result);
          }
        });
        
      }
    };
    
    
    return ParseClient;
    
};