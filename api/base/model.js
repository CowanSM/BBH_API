var mongo_driver = require('mongodb').MongoClient;
var assert = require('assert');
var _ = require('underscore');

module.exports = function(collectionName, cb, config, options)
{
    // console.log('model');

    var uri = 'mongodb://';

    if(config.mongo.replicaset)
    {
        uri = uri + config.mongo.user +':' + config.mongo.pwd +'@';

        for(var item in config.mongo.hosts)
        {
            var host = config.mongo.hosts[item];

            uri = uri + host.address + ':' + host.port + ',';
        }

        uri = uri.substring(0, uri.lastIndexOf(','));
    }
    else
    {
    }

    uri = uri + '/' + config.mongo.db + '?replicaSet='+'rs-ds045480';

    // console.log('mongo uri ' + uri);
    
    var collection;
    mongo_driver.connect(uri, function(err, db)
    {
        assert.equal(null, err);
        // console.log('Connected correctly to server');

        collection = db.collection(collectionName);

//        db.close();

        cb({collection:collection});
    });

    var retVal = 
    {
        find      : function(query, cb){
//            console.log('find');

            collection.find(query).toArray(function(err, result){
               cb(err, result);
            });
        },
        insert    : function(query, data, cb){
            console.log('insert');
        },
        update    : function(query, data, cb){
            console.log('update');

//            collection.update(query,)
        }
    };

    return retVal;
}