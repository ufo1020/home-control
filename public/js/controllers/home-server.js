var support_panel = angular.module('HomeControl', ['nvd3']);
var host_address = "192.168.1.142:5000";
var socket = io.connect('http://'+host_address);

support_panel.controller('mainController', function($interval, $scope, $http) {
    var vm = this;
    vm.settle_temperature = 2 // 2 degrees for settling 
    vm.nvd3_options = {
        chart: {
            type: 'lineChart',
            width: window.innerWidth,
            height: window.innerHeight * 0.8,
            margin : {
                top: 20,
                right: 20,
                bottom: 40,
                left: 55
            },
            // clipEdge: true,
            // interpolate: 'monotone',
            // rightAlignYAxis: true,
            x: function(d){ return d.x; },
            y: function(d){ return d.y; },
            yDomain: [10, 25],
            useInteractiveGuideline: true,
            dispatch: {
                stateChange: function(e){ console.log("stateChange"); },
                changeState: function(e){ console.log("changeState"); },
                tooltipShow: function(e){ console.log("tooltipShow"); },
                tooltipHide: function(e){ console.log("tooltipHide"); }
            },
 
            xAxis: {
                axisLabel: 'Time',
                tickFormat: function(d) {
                  //nvd3 date format: https://bl.ocks.org/zanarmstrong/ca0adb7e426c12c06a95
                  return d3.time.format('%H:%M')(new Date(d)) 
               }
            },
            yAxis: {
                axisLabel: 'Temperature(C)',
                tickFormat: function(d){
                    return d3.format('.02f')(d);
                },
                axisLabelDistance: 30
            },
            callback: function(chart){
                //console.log("!!! lineChart callback !!!");
            }
        },
        title: {
            enable: true,
            text: "Home temperature"
        },
        subtitle: {
            enable: true,
            text: "1 day temperature data",
            css: {
                'text-align': 'center',
                'margin': '10px 13px 0px 7px'
            }
        }
    };
    vm.report_data = [];
    vm.temperature_settings_text = [];
    vm.current_temp = 0.0;
    vm.target_temp = 0.0;
    vm.update_temperatures_response_text = '';
    vm.update_timers_response_text = '';
    vm.update_report_response_text = '';
    vm.time_queue = [];
    vm.enable_time = false;
    vm.switch_on = false;
    vm.timers = '';
    vm.pages = {'MainPage':0,'TimerPage':1,'PlotPage':2};

    vm.range  = function(start, end, step = 1, offset = 0) {
        return Array.apply(null, Array((Math.abs(end - start) + ((offset||0)*2))/(step||1)+1)) .map(function(_, i)
            { return start < end ? i*(step||1) + start - (offset||0) :  (start - (i*(step||1))) + (offset||0) })
    }

    socket.on('/', function(data) {
        vm.log_text += '\r\n';
        vm.log_text += data;
        $scope.$apply(function() { });
        // TODO: clear size of logs
    });

    socket.on('logs', function(data) {
        vm.log_text += '\r\n';
        vm.log_text += data;
        vm.force_binding_update();
    });

    socket.on('full-logs', function(data) {
        vm.log_text_full += '\r\n';
        vm.log_text_full += data;
        vm.force_binding_update();
    });

    vm.force_binding_update = function() {
        $scope.$apply(function() { });
    };

    socket.on('temp-log', function(data) {
        vm.update_temperatures_response_text += data;
    });

    socket.on('timer-log', function(data) {
        vm.update_timers_response_text += data;
    });    

    socket.on('mode-log', function(data) {
        vm.mode_response_text += data;
    });

    socket.on('report-log', function(data) {
        vm.update_report_response_text += data;
    });

    // vm.add_setting = function() {
    //     var item = "";
        
    //     if (vm.target_temperature_text > 0) {
    //         item += vm.target_temperature_text + "°C";
    //         if (vm.enable_time) {
    //             var t = "";
    //             if (vm.time_h < 10) {
    //                 t = '0' + vm.time_h;
    //             } else {
    //                 t = vm.time_m;
    //             }
    //             t += ":";                
    //             if (vm.time_m < 10) {
    //                 t += '0' + vm.time_m;
    //             } else {
    //                 t += vm.time_m;
    //             }
    //             item += "@" + t;

    //         } else {
    //             vm.target_temperature = vm.target_temperature_text;
    //         }
    //         vm.temperature_settings_text.push(item);
    //         vm.remove_duplicate_settings();
    //         vm.update_time_queue();
    //     }
    // };

    // vm.update_time_queue = function() {
    //     vm.time_queue = [];
    //     for (var item in vm.temperature_settings_text) {
    //         // @ means item has time setting
    //         if (vm.is_key_exist(item, "@")) {
    //             // 13C@03:02
    //             var index_of_divider = itemitem.indexOf("@");
    //             var index_of_time_divider = itemitem.indexOf(":");
    //             var temperature = item.slice(0, index_of_divider - 1);
    //             var time_h = item.slice(index_of_divider + 1, index_of_time_divider);
    //             var time_m = item.slice(index_of_time_divider + 1);
    //             var d = new Date();
    //             d.setHours(time_h);
    //             d.setMinutes(time_m);
    //             vm.time_queue.push({"temperature":int(temperature), "time":d});
    //         }
    //     }
    //     // sorting the queue
    //     if (vm.time_queue.length > 1) {
    //         vm.time_queue.sort(function(a, b) {
    //             return a.time > b.time;
    //         });
    //     }        
    // };
                
    // vm.remove_duplicate_settings = function() {
    //     var new_list = [];
    //     for (var i = 0; i < vm.temperature_settings_text.length; i++) {
    //         // temperature only setting
    //         if (vm.temperature_settings_text[i].indexOf("@") == -1) {
    //             var to_remove = false;
    //             for (var j = i+1; j < vm.temperature_settings_text.length; j++) {
    //                 if (vm.temperature_settings_text[j].indexOf("@") == -1) {
    //                     to_remove = true;
    //                     break;
    //                 }
    //             }
    //             if (!to_remove) {
    //                 new_list.push(vm.temperature_settings_text[i]);
    //             }
    //         } else {
    //             var t = vm.temperature_settings_text[i].slice(vm.temperature_settings_text[i].indexOf("@")+1)
    //             var to_remove = false;
    //             for (var j = i+1; j < vm.temperature_settings_text.length; j++) {
    //                 if ( t === vm.temperature_settings_text[j].slice(vm.temperature_settings_text[j].indexOf("@")+1)) {
    //                     to_remove = true;
    //                     break;
    //                 }
    //             }
    //             if (!to_remove) {
    //                 new_list.push(vm.temperature_settings_text[i]);
    //             }
    //         }
    //     }
    //     return new_list;
    // };

    // vm.apply_switch_on = function() {        
    //     var args = "--set:" + (vm.switch_on ? "1" : "0");
    //     socket.emit('control-commands', 'runscript~temp-log~thermo_control~'+args, function(run_result) {
    //         console.log(run_result);
    //     });

    // };

    vm.on_timer_click= function() {
      var pages = document.querySelector('iron-pages');
      if (pages.selected == vm.pages['MainPage']) {
          pages.selected = vm.pages['TimerPage'];
      } else {
          pages.selected = vm.pages['MainPage'];
      }      
    };

    vm.on_chart_click= function() {
      var pages = document.querySelector('iron-pages');
      if (pages.selected == '0') {
          pages.selected = "2";
      } else {
          pages.selected = "0";
      }      
    };

    // document.addEventListener('WebComponentsReady', function() {
    //   var target = document.querySelector('#target');
    //   target.addEventListener('value-change', function() {
    //       vm.set_temperatures(target.value);
    //   });
    // });


    vm.turn_on = function() {
        // turn on default 18
		var target = document.querySelector('#target');
		console.log('going to ', target.value);
        vm.set_temperatures(target.value);
    };

    vm.turn_off = function() {
        // turn off default 20
        vm.set_temperatures(8);
    };

    vm.set_temperatures = function(value) {
        // Set target temperature
        var args = "--target:" + value;
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~'+args, function(run_result) {
            console.log(run_result);
        });
    };

    vm.add_timer = function() {
        // Add target temperature and time
        var time_target = document.querySelector('#time_target').value;
        var time_input = document.querySelector('#time_input').value;
        // time input format: 04:20
        time_input = time_input.split(":");
        var time_h = time_input[0];
        var time_m = time_input[1];
        var args = ""
        if (time_h != undefined && time_m != undefined && time_target != undefined) {
            args = "--set:" + time_target + "-" + time_h + "-" + time_m;
        }
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~'+args, function(run_result) {
            console.log(run_result);
        });
    };

    vm.update_temperatures = function() {
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~--get', function(run_result) {
            vm.extract_temperatures(vm.update_temperatures_response_text);
            // vm.check_settings();
            vm.update_temperatures_response_text = '';
        });
    };

    vm.extract_temperatures = function(data) {
        // '...@@RESPONSE@@ {"temperature": 20.019542694091797} @@RESPONSE@@...';
        var response = vm.get_response_string(data);
        if (response !== undefined) {
            vm.current_temp = response.temperature;
            vm.target_temp = response.target;
        }
    };

    vm.update_timers = function() {
        socket.emit('control-commands', 'runscript~timer-log~thermo_control~--gettimers', function(run_result) {
            // '...@@RESPONSE@@ [{'temp': 17, 'time': '04:20'}] @@RESPONSE@@...';
            var response = vm.get_response_string(vm.update_timers_response_text);
            if (response !== undefined) {
                vm.timers = '';
                for (var i = 0; i < response.length; i++) {
                   vm.timers += ' '+response[i].temp+'@'+response[i].time;
               }
            }
            vm.update_timers_response_text = '';
        });

    };

    vm.update_plot = function(value) {
        var args = "--plot:" + value;
        socket.emit('control-commands', 'runscript~report-log~thermo_control~'+args, function(run_result) {
            // console.log(run_result);
            // '...@@RESPONSE@@ [{'timestamp': '22:15', 'target': '0', 'temp': '19.9'}] @@RESPONSE@@...';
            var response = vm.get_response_string(vm.update_report_response_text);
            if (response !== undefined) {
              vm.extract_report(response);
            }
            vm.update_report_response_text = '';
            vm.nvd3_api.update();
        });
    };

    vm.extract_report = function(response) {
        // data: [{'timestamp': '22:6', 'target': '0', 'temp': '19.9'}, {'timestamp': '22:7', 'target': '0', 'temp': '19.9\n'}] 
        if (response !== undefined) {
            vm.report_data = [{values:[], key:'Current', color:'#0000ff'},{values:[], key:'Target', color:'#ff0000', area: true}];
            var current = [];
            var target = [];
            for (i = 0; i < response.length; i++) {
                var time = new Date(response[i].timestamp);
                current.push({x:time, y:parseFloat(response[i].temp)});
                target.push({x:time, y:parseFloat(response[i].target)});
            }
            vm.report_data[0].values = current;
            vm.report_data[1].values = target;
        };
    };

    vm.set_temperatures = function(value) {
        // Set target temperature
        var args = "--target:" + value;
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~'+args, function(run_result) {
            //console.log(run_result);
        });
    };

    vm.check_settings = function() {
        // check if target temperature set
        if (vm.target_temperature) {
            if (vm.current_temp > vm.settle_temperature + vm.target_temperature) {
                vm.switch_on = false;
            } else if (vm.current_temp < vm.target_temperature - vm.settle_temperature) {
                vm.switch_on = true;
            }
        }
        var new_list = [];
        for (var item in vm.time_queue) {
            var d = new Date;
            if (d.now() > item.time) {
                vm.target_temperature = item.temperature;
            } else {
                new_list.push(item);
            }
        }
        vm.time_queue = new_list;
    };

    // vm.is_key_exist = function(str, key) {
    //     if (str.indexOf(key) == -1) {
    //         return false;
    //     } else {
    //         return true;
    //     }
    // };

    vm.get_response_string = function(data) {
        // data is in the format:
        // '...@@RESPONSE@@ { ... } @@RESPONSE@@...
        if (data !== undefined) {
            var quoted = data.replace(/'/g, '\"');
            var parts = quoted.split('@@RESPONSE@@');
            if (parts.length > 2) {
                //console.log(parts[1]);
                if (parts[1] === ' FAILED ') {
                    // stop polling when an error is detected during periodic scripts
                    vm.disable_polling = true;
                }
                else {
                    return JSON.parse(parts[1]);
                }
            }
        }

        return undefined;
    };

    vm.run_script = function(script_description, script_param_string, callback) {
        socket.emit('control-commands', script_param_string, function(run_result) {
            callback(run_result);
        });
    };

    vm.fetch_temperatures = function(){
        //fetch temperatures immediately
        $http.get('http://'+host_address+'/fetch_temperatures').then(fetch_temperatures_successCallback, errorCallback);
    };

    function fetch_temperatures_successCallback(response){
        response = vm.get_response_string(response.data)
        if (response != undefined) {
            vm.current_temp = response.temperature;
            vm.target_temp = response.target;
        }
    };

    function errorCallback(error){
        //error code
    };

    vm.fetch_plot = function(){
        //fetch plot immediately
        $http.get('http://'+host_address+'/fetch_plot').then(fetch_plot_successCallback, errorCallback);
    };

    function fetch_plot_successCallback(response){
        response = vm.get_response_string(response.data)
        if (response != undefined) {
            vm.extract_report(response);
        }
    };

    vm.fetch_temperatures();
    vm.fetch_plot();
    $interval(vm.update_temperatures, 20000);
    $interval(vm.update_timers, 20000);
    $interval(function() { vm.update_plot(1440); }, 60000);
});

