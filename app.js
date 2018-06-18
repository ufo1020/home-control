var express = require('express');
app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var python_shell = require('python-shell');
var fs = require('fs');

app.use(express.static(__dirname + '/public'));
app.use('/libs', express.static(__dirname + '/node_modules'));
app.use('/components', express.static(__dirname + '/bower_components'));

server.listen(port=5000, host='192.168.1.142');
// console.log('Server running on: localhost:5000');

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', function (client) {
    var address = client.handshake.address;
    // console.log('connect to', address);

    client.on('disconnect', function() {
        console.log('disconnected');
    });

    client.on('control-commands', function (data, callback) {
        fields = data.split('~');
        // console.log(data, address);
        if (fields[0] == 'runscript') {
            var log_target = fields[1];
            var options = {
                mode: 'text',
                pythonOptions: ['-u'],      // to turn off output buffering
                scriptPath: '/home/debian/home-control/python-scripts/'
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

app.get('/fetch_temperatures', function(req, res) {
    var options = {
        mode: 'text',
        pythonOptions: ['-u'],      // to turn off output buffering
        scriptPath: '/home/debian/home-control/python-scripts/'
    };

    options.args = ['--get'];
    var script_name = 'thermo_control.py';
    var script_runner = new python_shell(script_name, options);
    script_runner.on('message', function(message) {
        res.send(message)
    });
});

app.get('/fetch_plot', function(req, res) {
    var options = {
        mode: 'text',
        pythonOptions: ['-u'],      // to turn off output buffering
        scriptPath: '/home/debian/home-control/python-scripts/'
    };

    options.args = ['--plot', '1440'];
    var script_name = 'thermo_control.py';
    var script_runner = new python_shell(script_name, options);
    script_runner.on('message', function(message) {
        res.send(message)
    });
});
