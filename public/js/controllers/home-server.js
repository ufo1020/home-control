var support_panel = angular.module('HomeControl', ['nvd3']);
var host_address = "192.168.1.142:5000";
var socket = io.connect('http://'+host_address);

support_panel.controller('mainController', function($interval, $scope, $http) {
    var vm = this;
    vm.settle_temperature = 2 // 2 degrees for settling 
    vm.nvd3_options = {
        chart: {
            type: 'lineChart',
            width: window.innerWidth * 0.95,
            height: window.innerHeight * 0.70,
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
            yDomain: [10, 30],
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
    vm.pages = {'mainPage':0,'powerPage':1, 'plotPage':2};

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

    vm.on_home_click= function() {
      var pages = document.querySelector('iron-pages');
      pages.selected = vm.pages['mainPage'];
    };

    vm.on_chart_click= function() {
      var pages = document.querySelector('iron-pages');
      pages.selected = vm.pages['plotPage'];
    };

    vm.on_power_click= function() {
      var pages = document.querySelector('iron-pages');
      pages.selected = vm.pages['powerPage'];
    };

    vm.on_delete_timer_click = function(time) {
        var args = "--deltimer:" + time;
        console.log(args);
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~'+args, function(run_result) {
            console.log(run_result);
        });
    };

    vm.range=[1,2,3,4,5];

    vm.set_temperatures = function(value) {
        // Set target temperature
        var args = "--target:" + value;
        console.log("going to");
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~'+args, function(run_result) {
            console.log(run_result);
            // update display
            vm.update_temperatures();
        });
    };

    vm.add_timer = function() {
        $('#timerDialog').modal('hide');
        var time_target = document.querySelector('#add_timer_target').value;
        var time_input = document.querySelector('#add_timer_time').value;
        var time_repeat = document.querySelector('#add_timer_repeat').value ? 1 : 0;
        // time input format: 04:20
        time_input = time_input.split(":");
        var time_h = time_input[0];
        var time_m = time_input[1];
        var args = ""
        if (time_h != undefined && time_m != undefined && time_target != undefined) {
            args = "--addtimer:" + time_target + "-" + time_h + "-" + time_m+"-"+time_repeat;
        }
        console.log(args);
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~'+args, function(run_result) {
            console.log(run_result);
//            vm.update_timers();
        });
    };

    vm.on_add_timer_click = function() {
        $('#timerDialog').modal('show');
    };

    vm.update_temperatures = function() {
        socket.emit('control-commands', 'runscript~temp-log~thermo_control~--get', function(run_result) {
            vm.extract_temperatures(vm.update_temperatures_response_text);
            vm.update_temperatures_response_text = '';
        });
    };

    vm.extract_temperatures = function(data) {
        // '...@@RESPONSE@@ {"temperature": 20.019542694091797} @@RESPONSE@@...';
        var response = vm.get_response_string(data);
        if (response !== undefined) {
            vm.current_temp = response.temperature;
            vm.target_temp = response.target;
            document.title = vm.current_temp + "°C - Home"
        }
    };

    vm.update_timers = function() {
        socket.emit('control-commands', 'runscript~timer-log~thermo_control~--gettimers', function(run_result) {
            // '...@@RESPONSE@@ [{'temp': 17, 'time': '04:20', 'repeat':'0'}] @@RESPONSE@@...';
            var response = vm.get_response_string(vm.update_timers_response_text);
            if (response !== undefined) {
                vm.timers = [];
                for (var i = 0; i < response.length; i++) {
                   vm.timers.push({temp:response[i].temp, time:response[i].time});
               }
               vm.update_timer_list();
            }
            vm.update_timers_response_text = '';
        });

    };

    vm.update_timer_list = function() {
        if (vm.timers.length > 0) {
            var node = document.getElementById("list-timers");
            // remove all children first
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }
            for (i = 0; i < vm.timers.length; i++) {
                // Add target temperature and time
                var a_element = document.createElement("a");
                a_element.setAttribute("class", "list-group-item list-group-item-action bg-light");
                a_element.setAttribute("id", "timer-"+vm.timers[i].time);
                a_element.setAttribute("data-toggle", "list");
                a_element.setAttribute("href", "#timerDialog");
                a_element.setAttribute("role", "tab");

                var span_element = document.createElement("span");
                span_element.setAttribute("class", "text-info")
                var text = document.createTextNode(vm.timers[i].time + " at " + vm.timers[i].temp + "°C");
                span_element.appendChild(text);

                var fab_element = document.createElement("paper-fab");
                fab_element.setAttribute("class", "most-right bg-warning");
                fab_element.setAttribute("icon", "icons:delete");
                fab_element.setAttribute("mini", "true");
                fab_element.setAttribute("ng-click", "ctrl.on_power_click("+vm.timers[i].time+")");

                a_element.appendChild(span_element);
                a_element.appendChild(fab_element);
                node.appendChild(a_element);
            }
        }
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
        // data: [{'timestamp': '22:6', 'target': '0', 'temperature': '19.9'}, {'timestamp': '22:7', 'target': '0', 'temperature': '19.9\n'}]
        if (response !== undefined) {
            vm.report_data = [{values:[], key:'Current', color:'#0000ff'},{values:[], key:'Target', color:'#ff0000', area: true}];
            var current = [];
            var target = [];
            for (i = 0; i < response.length; i++) {
                // timestamp format: "2015-12-31 00:00:00". According to:
                // https://stackoverflow.com/questions/13363673/javascript-date-is-invalid-on-ios
                // Date format need to be ISO-8601, the only change here is to replace space with T:
                // "2015-12-31T00:00:00"
                var time = new Date(response[i].timestamp.replace(' ', 'T'));
                if (typeof response[i].temperature === "string") {
                    response[i].temperature = parseFloat(response[i].temperature);
                }
                if (typeof response[i].target === "string") {
                    response[i].target = parseFloat(response[i].target);
                }
                current.push({x:time, y:response[i].temperature});
                target.push({x:time, y:response[i].target});
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

//    vm.check_settings = function() {
//        // check if target temperature set
//        if (vm.target_temperature) {
//            if (vm.current_temp > vm.settle_temperature + vm.target_temperature) {
//                vm.switch_on = false;
//            } else if (vm.current_temp < vm.target_temperature - vm.settle_temperature) {
//                vm.switch_on = true;
//            }
//        }
//        var new_list = [];
//        for (var item in vm.time_queue) {
//            var d = new Date;
//            if (d.now() > item.time) {
//                vm.target_temperature = item.temperature;
//            } else {
//                new_list.push(item);
//            }
//        }
//        vm.time_queue = new_list;
//    };

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
                    // in case of plot, response from mlab is:
                    // {u"timestamp": "2018-02-10", u"_id": ObjectId("5a7ff6e27456410cc8de3d05"), u"temperature": 24.2, "target": 0}
                    // in case unicode prefix 'u'
                    var processed_data = parts[1].replace(/u"/g, '"');
                    processed_data = processed_data.replace(/ObjectId\("(\w+)"\)/g, '"$1"');
                    return JSON.parse(processed_data);
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

    vm.show_loading_dialog = function(){
        $('#loadingDialog').modal('show');
    };

    vm.close_loading_dialog = function(){
        $('#loadingDialog').modal('hide');
    };

    vm.fetch_temperatures = function(){
        // fetch temperatures immediately
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
        //fetch plot immediately, due to long response time, open loading dialog
        vm.show_loading_dialog();
        $http.get('http://'+host_address+'/fetch_plot').then(fetch_plot_successCallback, errorCallback);
    };

    function fetch_plot_successCallback(response){
        response = vm.get_response_string(response.data)
        if (response != undefined) {
            vm.extract_report(response);
        }
        vm.close_loading_dialog();
    };

    vm.initialise = function() {
        // add slider event listener
        var target = document.querySelector('#target');
        target.addEventListener('value-change', function() {
          vm.set_temperatures(target.value);
        });

        vm.fetch_temperatures();
        vm.fetch_plot();
    };

    vm.initialise()
    vm.update_timers()
    $interval(vm.update_temperatures, 10000);
//    $interval(vm.update_timers, 10000);
    $interval(function() { vm.update_plot(1440); }, 60000);
});

