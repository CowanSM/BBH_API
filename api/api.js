var express = require('express');
var cluster = require('cluster'); //require('../node_modules/cluster');
var bodyParser = require('body-parser');

function run(app)
{
    var config = {};
    
    config.app = app;
    
    app.use(express.static(__dirname + '/../client'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    
    app.use(function(req,res,next)
    {
        // console.log('router function hit');
       
       console.log('params : ', req.params);
       console.log('body : ', req.body);
       console.log('query : ', req.query);
       
        next();
    });
    
    if(cluster.isWorker)
        config.workerId = cluster.worker.id;
    else
        config.master = true;

    require('./router')(config);
    
    return app;
}

if(process.env.cloud9)
{
    var app = run(express());
    
    //Vedad 
    //dev environment always on ports 291**
    //prod environment always on ports 290**
    var port = 29117;
    if(process.env.NODE_ENV == 'production')
        port = 29017;
    
    var serverPort = port;
    
    app.listen(serverPort);
    
    console.log('server started on port : ', serverPort);
    
    return;   
}

if(cluster.isMaster)
{
    console.log('starting server...');
    
    var cpuCount = require('os').cpus().length;
    
    console.log('cpu count : ' + cpuCount);
    
    run(express());
    
    //Vedad - working on different concept, not functional yet
    // cluster(app).listen(29117);
    
    //Vedad - create our cluster
    for(var i = 0;i < cpuCount; i += 1)
    {
        cluster.fork();
    }
}
else
{
    function log(m)
    {
        console.log(cluster.worker.id, ' : ', m);
    }
    
    var app = run(express());
    
    //Vedad 
    //dev environment always on ports 291**
    //prod environment always on ports 290**
    var port = 29117;
    if(process.env.NODE_ENV == 'production')
        port = 29017;
    
    
    //Vedad - we want no routes here. All routes should be in custom modules under the routes directory
    // app.use(function(req,res,next){
    //    console.log('router function hit');
       
    //    console.log('req params : ', req.params);
    //    console.log('req body : ', req.body);
       
    //    //Vedad - check auth here somehow?
       
    //    next();
    // });
    
    // app.get('/', function(req,res){
    //   log('index hit');
       
    //   res.send('ok');
    // });
    
    // app.get('/testLoad', function(req,res)
    // {
    //     log('testLoad');
        
    //     log('starting timeout');
        
    //     setTimeout(function()
    //     {
    //         log('timeout invoked. starting arithmetic loop');
            
    //         var number = 1;
    //         while(number < 100)
    //         {
    //             number *= 2;
    //         }
            
    //         res.send(cluster.worker.id + ' finished');
    //     }, 5000);
    // });
    
    var serverPort = port;
    
    app.listen(serverPort);
    
    console.log('server started on port : ', serverPort, ' clusterId : ', cluster.worker.id );
}