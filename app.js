var express = require('express');
app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var fs = require('fs');

app.use(express.static(__dirname + '/public'));
app.use("/components", express.static(__dirname + '/bower_components'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

server.listen(port=5000, host='192.168.217.139');
console.log('Server running on: localhost:5000');

app.get('/', function (req, res) {
    //res.sendFile(__dirname + '/public/index.html');
    res.render('support-panel.jade');
});

io.on('connection', function (client) {
    console.log('connected');


    client.on('disconnect', function() {
        console.log('disconnected');
    });

});
