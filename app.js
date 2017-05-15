var express = require('express');
app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var python_shell = require('python-shell');
var fs = require('fs');

app.use(express.static(__dirname + '/public'));
app.use('/libs', express.static(__dirname + '/node_modules'));
app.use('/components', express.static(__dirname + '/bower_components'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

server.listen(port=5000, host='10.0.0.22');
console.log('Server running on: localhost:5000');

app.get('/', function (req, res) {
    //res.sendFile(__dirname + '/public/index.html');
    res.render('home-server.jade');
});

io.on('connection', function (client) {
    console.log('connected');

    client.on('disconnect', function() {
        console.log('disconnected');
    });

    client.on('control-commands', function (data, callback) {
        fields = data.split('~');
        if (fields[0] == 'runscript') {
            var log_target = fields[1];
            var options = {
                mode: 'text',
                pythonOptions: ['-u'],      // to turn off output buffering
                scriptPath: '/root/home-control/python-scripts/'
            };

            options.args = fields[3].split(':');
            var script_name = fields[2]+'.py';

		    var script_runner = new python_shell(script_name, options);
            script_runner.on('message', function(message) {
                if (log_target != 'logs') {
                    client.volatile.emit(log_target, message);
                }
            });

            script_runner.on('error', function(err) {
                if (log_target != 'logs') {
                    client.volatile.emit(log_target, err);
                }
                console.log(err)
                callback(err, script_runner.exitCode)
            });

            script_runner.on('close', function() {
                if (log_target != 'logs') {
                   client.volatile.emit(log_target, 'Ran command: ' + data);
                }
                callback(null, script_runner.exitCode)
            });
        }
        else {
            client.volatile.emit('logs', 'Command: '+data);
            client.volatile.emit('logs', 'fields: '+fields);
            client.volatile.emit('logs', 'unknown command: '+fields[0]);
            callback(null, -1)
        }
    });
});
