var support_panel = angular.module('SupportPanel', ['ui.bootstrap', 'angular-dialgauge', 'ngMaterial', 'nvd3']);
var socket = io.connect('http://192.168.217.139:5000');

// directive to move to the last line of a text area when updated
angular.module('SupportPanel').directive('rollingLog', function ($parse) {
    return function (scope, elem, attrs) {
        maxLength = parseInt(attrs.maxLength)
        deleteBlockSize = parseInt(attrs.deleteBlockSize)
        //Modify this so it watches the actual log buffer
        // and updates the element value
        // and fixes the selection bits
        // and does rollover
        scope.$watch(attrs.rollingLog,
            function (newValue) {
                if(newValue === undefined) {
                    newValue = ''
                }

                var textArea = elem[0];

                //Get user interaction state
                var start = textArea.selectionStart;
                var end = textArea.selectionEnd;
                var direction = textArea.selectionDirection;
                var oldScrollTop = textArea.scrollTop
                var oldHeight = textArea.offsetHeight
                var oldScrollHeight = textArea.scrollHeight

                //Find total height before removal, so we can figure out how much height
                //is removed
                textArea.value = newValue
                var midScrollHeight = textArea.scrollHeight

                //Delete lines as needed for logs
                var charsDeleted = 0

                if(newValue.length > maxLength)
                {
                    var newStart = deleteBlockSize + newValue.length - maxLength
                    charsDeleted = newValue.indexOf('\n', newStart)
                    newValue = newValue.substring(charsDeleted)

                    var model = $parse(attrs.rollingLog);
                    model.assign(scope,newValue);

                    //For whatever reason, the underlying string and the textarea disagree
                    //about the number of characters in a string.
                    realCharCount = textArea.value.length
                    textArea.value = newValue
                    charsDeleted = realCharCount - textArea.value.length
                }


                var newScrollHeight = textArea.scrollHeight

                //Jump to bottom if we were already there.
                if(oldScrollTop + oldHeight >= oldScrollHeight) {
                    textArea.scrollTop = textArea.scrollHeight;
                } else if (newScrollHeight !== midScrollHeight) {
                    textArea.scrollTop = oldScrollTop + newScrollHeight - midScrollHeight;
                }

                var activeElement = document.activeElement;
                if(textArea === activeElement) {
                    textArea.selectionStart = start - charsDeleted;
                    textArea.selectionEnd = end - charsDeleted;
                    textArea.selectionDirection = direction;
                }
            });
    }
});

support_panel.controller('mainController', function($interval, $scope, $mdDialog, $http) {
    var vm = this;
    vm.rowLabels = "ABCDEFGH";
    vm.ssm_color = 'smoke';
    vm.bottle_color = 'smoke';
    vm.isCollapsed = false;
    vm.auto_bw_mode = false;
    vm.disable_polling = false;
    vm.mix_bw_interval = undefined;
    vm.ssm_scavenge_duration = 5000;
    vm.selected_scavenge_ssm = 'All';
    vm.fill_di_duration = 180;
    vm.mix_bw_volume = 200;
    vm.selected_ssm = 'All';
    vm.master_mode = 'direct';
    vm.selected_vent_bank = 'SSM Bank 1';
    vm.bank_vent_duration = 5000;
    vm.update_pressures_running = false;
    vm.update_temperatures_running = false;
    vm.update_bottles_running = false;
    vm.get_lid_lock_state_running = false;
    vm.initialise_running = false;
    vm.disable_graphing = true;
    vm.graph_update_duration_ms = 4000;   // duration to retrieve status logs since last update, 
                                          // a large duration could make sure it looks back in status logs
                                          // long enough to avoid skipping any logs.
    vm.graph_start_time = 0;
    vm.y_domain_min = -20;
    vm.y_domain_max = 50;
    vm.x_domain_max = 30; // x axis time duration in seconds
    vm.sample_rate = 10;
    vm.first_timestamp = 0;
    vm.logging_frequency_hz= 100; // maximum status logs frequency
    vm.graph_buffered_items = vm.x_domain_max * vm.logging_frequency_hz;    // items to display
    vm.report_data = [];
    vm.buffered_data = [];
    vm.save_to_file = false;
    vm.export_file = "C:\\Users\\Taipan\\Desktop\\PressureSensors.log"
    vm.is_loading = false;

    vm.waste_type = 'Standard';
    vm.waste_types = ['Both', 'Standard', 'Hazardous'];
    vm.waste_duration = 180;

    vm.selected_open_close_ssm = 'All';
    vm.firmware_details = '';

    vm.single_prime_volume = 100;
    vm.single_prime_line = 'DI';
    vm.single_prime_lines = ['TISSUE-DIGESTANT', 'HV-DI', 'HV-BW', 'DI', 'ER1', 'ER2', 'ALCOHOL', 'DEWAX',
                             'WR-FRONT-DI', 'WR-FRONT-BW', 'WR-REAR-DI', 'WR-REAR-BW',
                             'BWMIX-CONC', 'BWMIX-DI', 'BWMIX'];

    vm.closed_bulk_bottle_options = ['ALCOHOL', 'DEWAX', 'ER1', 'ER2', 'TISSUE-DIGESTANT', 'BW-CONC'];
    vm.closed_bulk_bottle_service_modes = ['REFILL', 'REMOVE-BOTTLE'];
    vm.closed_bulk_bottle_service_mode = vm.closed_bulk_bottle_service_modes[0];
    vm.closed_bulk_bottle = vm.closed_bulk_bottle_options[0];

    vm.lsp_id = '';
    vm.config_warning = '';
    vm.release_version = '';
    vm.warning_bar_class = '';

    vm.check_instrument_config = function() {
        $http.get('http://localhost:5000/check_instrument_config').success(function(data){
            vm.lsp_id = data.lsp_id;
            vm.config_warning = data.config_warning;
            vm.release_version = data.release_version;
            vm.warning_bar_class = data.warning_bar_class;
        });
    };

    vm.robot_vacuum_pressure_kPa = 0;
    vm.robot_vacuum_raw_ADC = 0;
    vm.std_scavenge_pressure_kPa = 0;
    vm.std_scavenge_raw_ADC = 0;
    vm.haz_scavenge_pressure_kPa = 0;
    vm.haz_scavenge_raw_ADC = 0;
    vm.ssm_bank2_scavenge_pressure_kPa = 0;
    vm.ssm_bank2_scavenge_raw_ADC = 0;
    vm.main_robot_er1_pressure_kPa = 0;
    vm.main_robot_er1_raw_ADC = 0;
    vm.bulk_valve_haz_scavenge_high_level_state = 0;

    vm.update_temperatures_response_text = '';
    vm.update_pressures_response_text = '';
    vm.update_bottles_response_text = '';
    vm.log_text = '';
    vm.log_text_changed = false;
    vm.log_text_full = '';
    vm.log_text_full_changed = false;
    vm.log_text_filtered = '';
    vm.mode_response_text = '';
    vm.firmware_response_text = '';
    vm.update_report_response_text = '';



    vm.log_filter_start_time = '';
    vm.log_filter_end_time = '';
    vm.log_error_filters = [];
    vm.log_context_filters = [];
    vm.log_filter_query = '';
    vm.log_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "FATAL", "ALARM"];
    vm.log_new_filter_level = 'INFO';
    vm.log_filter_command_line = '';
    vm.lid_lock_state = 'Unknown';
    vm.lid_classes = {Unknown: 'label-default', Open: 'label-warning', Closed: 'label-success'};
    vm.lid_class = vm.lid_classes[vm.lid_lock_state];
    vm.lid_lock_state_text = '';

    vm.reset_new_context_filter_input = function() {
        vm.log_new_filter_source = '';
        vm.log_new_filter_match = '';
        vm.log_new_filter_regex = false;
    }


    vm.reset_new_context_filter_input()


    vm.sensors = {
        front_wash_robot_bw_pressure: false, 
        rear_wash_robot_bw_pressure: false,
        bw_mix_pressure: false, 
        tissue_digestant_concentrate_pressure: false,
        dewax_pressure: false, 
        er1_pressure: false,
        er2_pressure: false, 
        alcohol_pressure: false,
        coolant_pressure: false,
        coolant_temperature: false,
        main_probe_pressure: false,
        wash_bw_pressure: false,
        std_scavenge_pressure: false, 
        haz_scavenge_pressure: false,
        robot_vacuum_pressure: false, 
        slide_pickup_pressure: false,
        ssm_bank1_scavenge_pressure: false, 
        ssm_bank2_scavenge_pressure: false
    };

    vm.sensors_colors = {
        front_wash_robot_bw_pressure: '#381e15',
        rear_wash_robot_bw_pressure: '#ee6131',
        bw_mix_pressure: '#f6eb7f',
        tissue_digestant_concentrate_pressure: '#859c76',
        dewax_pressure: '#a97c63',
        er1_pressure: '#2038b2',
        er2_pressure: '#4ed01a',
        alcohol_pressure: '#dfec11',
        coolant_pressure: '#ce1616',
        coolant_temperature: '#46ca32',
        main_probe_pressure: '#c53ace',
        wash_bw_pressure: '#eca35c',
        std_scavenge_pressure: '#172a6d',
        haz_scavenge_pressure: '#691537',
        robot_vacuum_pressure: '#eaa0b6',
        slide_pickup_pressure: '#b9d6ec',
        ssm_bank1_scavenge_pressure: '#ff7f0e',
        ssm_bank2_scavenge_pressure: '#2b6300'
    };

    vm.sensor_scales = {
        front_wash_robot_bw_pressure: '0.001',
        rear_wash_robot_bw_pressure: '0.001',
        bw_mix_pressure: '0.001',
        tissue_digestant_concentrate_pressure: '0.001',
        dewax_pressure: '0.001',
        er1_pressure: '0.001',
        er2_pressure: '0.001',
        alcohol_pressure: '0.001',
        coolant_pressure: '0.001',
        coolant_temperature: '0.001',
        main_probe_pressure: '0.001',
        wash_bw_pressure: '0.001',
        std_scavenge_pressure: '0.001',
        haz_scavenge_pressure: '0.001',
        robot_vacuum_pressure: '0.001',
        slide_pickup_pressure: '0.001',
        ssm_bank1_scavenge_pressure: '0.001',
        ssm_bank2_scavenge_pressure: '0.001'
    };

    vm.options = {
        chart: {
            type: 'lineWithFocusChart',
            width: 1200,
            height: 600,
            margin : {
                top: 20,
                right: 20,
                bottom: 40,
                left: 55
            },
            clipEdge: true,
            interpolate: 'monotone',
            rightAlignYAxis: true,
            x: function(d){ return d.x; },
            y: function(d){ return d.y; },
            yDomain: [vm.y_domain_min, vm.y_domain_max],
            useInteractiveGuideline: true,
            dispatch: {
                stateChange: function(e){ console.log("stateChange"); },
                changeState: function(e){ console.log("changeState"); },
                tooltipShow: function(e){ console.log("tooltipShow"); },
                tooltipHide: function(e){ console.log("tooltipHide"); }
            },
 
            xAxis: {
                axisLabel: 'Time Delta (ms)'
            },
            yAxis: {
                axisLabel: 'Sensor Units (unit)',
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
            text: "Sensor Report"
        },
        subtitle: {
            enable: true,
            text: "Sensor logging",
            css: {
                'text-align': 'center',
                'margin': '10px 13px 0px 7px'
            }
        },
        caption: {
            enable: true,
            html: "<b>Report 1.</b> ",
            css: {
                "text-align": "justify",
                "margin": "10px 13px 0px 7px"
            }
        }
    };

    vm.start_report = function() {
      vm.disable_graphing = false;
      // each time start reporting will base on the latest timestamp by resetting
      // start time to 0
      vm.graph_start_time = 0;
      vm.report_data = [];
      vm.buffered_data = [];
      vm.first_timestamp = 0;
      vm.options.chart.yDomain = [vm.y_domain_min, vm.y_domain_max];
      vm.options.subtitle.text = "Sensor logging at " + vm.sample_rate + "HZ";
      vm.graph_buffered_items = vm.x_domain_max * vm.logging_frequency_hz;
      vm.load_report();
    }

    vm.stop_report = function() {
      vm.disable_graphing = true;
    };

    vm.load_report = function() {
        if (vm.disable_graphing) {
            return;
        }

        if (vm.is_loading) {
            return
        }

        vm.is_loading = true
        var sensors = '';
        for (var key in vm.sensors) {
            if (vm.sensors[key]) {
                sensors += key+'-';
            }
        }
        var args='--stime:' + vm.graph_start_time + ':';
        args += '--duration:' + vm.graph_update_duration_ms + ':';
        args += '--sensors:' + sensors;
        if (vm.save_to_file) {
            // replace : with /
            args += ':' + '--saveTo:' + vm.export_file.replace(/:/g, "/");
        }

        vm.run_script(false, 'Get Sensors', 'runscript~report-log~get_sensor_status_log~'+args, function(run_result) {
            vm.extract_report(vm.update_report_response_text);
            vm.update_report_response_text = '';
            vm.api.update();
            vm.is_loading = false;
            vm.load_report();
        });
    };

    vm.extract_report = function(data) {
        var i;
        var response = vm.get_response_string(data);

        if (response !== undefined) {
           var reports = response.reports;
           if (reports[0] !== undefined) {
               var sensor_data = new Array(Object.keys(reports[0]).length - 1);
               for (i = 0; i < sensor_data.length; i++) {
                   sensor_data[i] = new Array(reports.length);
               }
               var sensor_names = new Array(Object.keys(reports[0]).length - 1);
               if (vm.first_timestamp === 0) {
                   vm.first_timestamp = new Date(reports[0].time);
               }
               for (i = 0; i < reports.length; i++) {
                   var timestatmp = new Date(reports[i].time);
                   var time_offset = timestatmp - vm.first_timestamp;
                   if (i === reports.length - 1) {
                       // need to replace : with /
                       vm.graph_start_time = reports[i].time.replace(/:/g, "/");
                   }

                   var sensor_index = 0;
                   var keys = Object.keys(reports[i]);
                   for (var key in keys) {
                       if (keys[key] !== 'time') {
                           // only set names once
                           if (i === 0) {
                               sensor_names[sensor_index] = keys[key];
                           }
                           var offset = 1;
                           if (vm.sensor_scales[keys[key]]) {
                               offset = parseFloat(vm.sensor_scales[keys[key]]);
                           }
                           sensor_data[sensor_index][i] = {x: time_offset, y: reports[i][keys[key]] * offset};
                           sensor_index++;
                       }
                   }
               }
           }
           else {
               return;
           }

           // init buffered data only once
           if (vm.buffered_data.length === 0) {
               vm.buffered_data = new Array(sensor_names.length);
               for (i = 0; i < sensor_names.length; i++) {
                   vm.buffered_data[i] = [];
               }
           }
           if (vm.report_data.length === 0) {
               for (var i = 0; i < sensor_names.length; i++) {
                   vm.report_data.push({values:[], key: sensor_names[i], color:vm.sensors_colors[sensor_names[i]]});
               }
           }
           //Data is represented as an array of {x,y} pairs.
           for (var i = 0; i < sensor_names.length; i++) {
               var new_start = Object.keys(vm.buffered_data[i]).length  + Object.keys(sensor_data[i]).length - vm.graph_buffered_items
               if (new_start < 0) {
                    new_start = 0
               }
               var d = vm.buffered_data[i].slice(new_start);
               vm.buffered_data[i] = d.concat(sensor_data[i]);
 
               var d = [];
               for (var n = 0; n < Object.keys(vm.buffered_data[i]).length; n+=100/vm.sample_rate) {
                   d.push(vm.buffered_data[i][n]);
               }
               vm.report_data[i].values = d;
           }
       }
    };

    vm.regulate_sample_rate = function() {
        if (vm.sample_rate < 0) vm.sample_rate = 0;
        if (vm.sample_rate > 100) vm.sample_rate = 100;
    }


    vm.get_bank_character = function(bank_id) {
        return String.fromCharCode(64+bank_id) + ((bank_id === 1) ? ' (Back)' : ' (Front)');
    };

    vm.get_ssm_state = function(ssm_id) {
        return vm.ssms[ssm_id].state;
    };

    vm.get_ssm_identification = function(ssm_id) {
        var board_index = Math.round(ssm_id/2);
        var ssm_module = (ssm_id % 2 === 0) ? 'A' : 'B';
        return Number(ssm_id).toString()+'/'+Number(board_index).toString()+ssm_module;
    };

    vm.auto_mix_bw = function() {
        if (vm.disable_polling) {
            // do not mix while disable_polling (boards resetting etc.)
            return;
        }

        // do not show the dialog when auto-mixing
        vm.mix_bw(false);
    };

    vm.apply_auto_bw_mode = function() {
        if (vm.auto_bw_mode) {
            // cancel old timer
            if (vm.mix_bw_interval !== undefined) {
                $interval.cancel(vm.mix_bw_interval);
                vm.mix_bw_interval = undefined;
            }

            // start a 5 minute interval
            vm.mix_bw_interval = $interval(vm.auto_mix_bw, 600000);
        }
        else {
            // cancel old timer
            if (vm.mix_bw_interval !== undefined) {
                $interval.cancel(vm.mix_bw_interval);
                vm.mix_bw_interval = undefined;
            }
        }
    };

    vm.unlock_closed_bulk_bottle = function() {
        vm.run_script(true, 'Unlocking Bottles', 'runscript~logs~unlock_closed_bulk_bottles~'+vm.closed_bulk_bottle+':'+vm.closed_bulk_bottle_service_mode, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.set_ssm_state =  function(ssm_id, state){
        vm.ssms[ssm_id].state = state;
    };

    vm.set_temperature = function(ssm_id, temperature){
        vm.ssms[ssm_id].temperature = temperature;
    };

    vm.ssm_list = [];
    vm.ssm_list[0] = 'All';
    var ssm_id;
    for (ssm_id=1; ssm_id<25; ssm_id++) {
        vm.ssm_list[ssm_id] = 'SSM '+ssm_id;   // construct the SSM array for ambient script
    }

    vm.ssm_bank_list = [];
    vm.ssm_bank_list[0] = 'SSM Bank 1';
    vm.ssm_bank_list[1] = 'SSM Bank 2';

    // set starting temperatures
    vm.ssms = [];
    for (ssm_id=1; ssm_id<25; ssm_id++) {
        vm.ssms[ssm_id] = {};
        var temperature = 28;
        vm.set_temperature(ssm_id, temperature);
    }

    // running dialog
    vm.show_script_running = function(script_description) {
        var confirm = $mdDialog.alert()
            .title('Script running...')
            .htmlContent(script_description+'.<br/> Please wait for the script to complete.')
            .ok('Cancel');

        $mdDialog.show(confirm).then(function() {
            // OK button clicked
        });

        return confirm;
    };

    // Liquid Level Gauges

    vm.bottles = [];

    vm.bottle_names = ['DI Bulk',
                       'Alcohol',
                       'Dewax',
                       'ER1',
                       'ER2',
                       'Tis. Dig. Conc',
                       'BW Conc',
                       'Std Bulk',
                       'Haz Bulk',
                       'DI Temp 1',
                       'DI Temp 2',
                       'BW Temp',
                       'Std Temp',
                       'Haz Temp'];

    vm.set_bottle_level = function(bottle_id, liquid_level) {
        vm.bottles[bottle_id].liquid_level = liquid_level;
    };

    vm.set_bottle_state = function(bottle_id, state) {
        vm.bottles[bottle_id].state = state;
    };

    for (bottle_id=0; bottle_id < 14; bottle_id++) {
        vm.bottles[bottle_id] = {};
        var liquid_level = 0;
        vm.bottles[bottle_id].name = vm.bottle_names[bottle_id];
        vm.set_bottle_level(bottle_id, liquid_level);
        vm.set_bottle_state(bottle_id, 'Inactive');
    };

    vm.identify_bottle_by_id = function(bottle_id) {
        return vm.bottles[bottle_id].name;
    }

    // for commissioning test
    vm.commissioning_tests = [
        "full",
        "smoke_test",
        "test_initialise",
        "test_initialise_boards",
        "test_initialise_vacuum",
        "test_initialise_cooling",
        "test_initialise_ssm",
        "test_initialise_gantry_robot",
        "test_initialise_wash_robot",
        "test_initialise_fluidics",
        "test_gantry_robot",
        "test_hv_probe_wash",
        "test_hv_pickup_place_ssm",
        "test_ssm_peltier",
        "test_hv_probe_agitation",
        "test_hv_place_ssm_jet",
        "test_brh_place_ssm",
        "test_ssm_scavenge",
        "test_wash_robot",
        "test_cooling_valve",
        "test_probe_cal_ssm",
        "test_bulk_probe_dispense",
        "test_hv_probe_dispense",
        "test_wash_robot_dry",
        "test_shutdown",
        "disable_shutdown",
        "disable_heating"];
    vm.selected_commissioning_test = "";
    vm.commissioning_ssm_list = [];
    vm.ssm_test_default_set = [0, 1, 2, 3, 6, 9, 14, 15, 17, 18, 22, 23];
    vm.ssm_smoke_test_default_set = [0, 3, 5, 10, 13, 15, 17, 21];

    vm.commissioning_reagent_list = [];
    vm.commissioning_reagent_row = [];
    vm.reagent_test_default_set = [0, 4, 9, 10, 14, 17, 18, 28, 35, 47, 56, 65];
    vm.reagent_smoke_test_default_set = [0, 13, 33, 43];

    vm.commissioning_mixing_vials_list = [];
    vm.mixing_vials_test_default_set = [0, 7, 9, 14, 43, 44, 51, 52, 81, 86, 88, 95];
    vm.mixing_vials_smoke_test_default_set = [0, 7, 88, 95];

    vm.allSSMs = false;
    vm.allReagents = false;
    vm.allMixingVials = false;

    vm.is_running_commissioning = false;

    var id;
    for (id=0; id<24; id++) {
        vm.commissioning_ssm_list[id] = false;
    }

    for (id=0; id<14; id++) {
        vm.commissioning_reagent_row[id] = false;
    }

    for (id=0; id<70; id++) {
        vm.commissioning_reagent_list[id] = false;
    }

    for (id=0; id<96; id++) {
        vm.commissioning_mixing_vials_list[id] = false;
    }

    for (id in vm.ssm_test_default_set) {
        vm.commissioning_ssm_list[vm.ssm_test_default_set[id]] = true;
    }

    for (id in vm.reagent_test_default_set) {
        vm.commissioning_reagent_list[vm.reagent_test_default_set[id]] = true;
    }

    for (id in vm.mixing_vials_test_default_set) {
        vm.commissioning_mixing_vials_list[vm.mixing_vials_test_default_set[id]] = true;
    }

    vm.reagentRowChecked = function(id) {
        vm.commissioning_reagent_row[id-1] = true;
        for (var reagent=0; reagent<5; reagent++) {
            if (!vm.commissioning_reagent_list[(id-1)*5+reagent]){
                vm.commissioning_reagent_row[id-1] = false;
                break;
            }
        }
        return vm.commissioning_reagent_row[id-1];
    }

    vm.toggleReagentRow = function(id) {
        var selected = vm.commissioning_reagent_row[id-1]?false:true;
        for (var reagent=0; reagent<5; reagent++) {
            vm.commissioning_reagent_list[(id-1)*5+reagent] = selected;
        }

        vm.allReagents = true;
        for (var reagent_id=0; reagent_id<vm.commissioning_reagent_list.length; reagent_id++) {
            if (!vm.commissioning_reagent_list[reagent_id]) {
                vm.allReagents = false;
                break;
            }
        }
    }

    vm.ssmChecked= function(id) {
        return vm.commissioning_ssm_list[id];
    }

    vm.reagentChecked= function(id) {
        return vm.commissioning_reagent_list[id];
    }

    vm.mixingVialChecked = function(id) {
        return vm.commissioning_mixing_vials_list[id];
    }

    vm.toggleAllSSMs = function() {
        var selected = vm.allSSMs?false:true;
        for (var id=0; id<vm.commissioning_ssm_list.length; id++) {
            vm.commissioning_ssm_list[id] = selected;
        }
    }

    vm.toggleAllReagents = function() {
        var selected = vm.allReagents?false:true;
        for (var id=0; id<vm.commissioning_reagent_list.length; id++) {
            vm.commissioning_reagent_list[id] = selected;
        }
    }

    vm.toggleAllsMixingVials = function() {
        var selected = vm.allMixingVials?false:true;
        for (var id=0; id<vm.commissioning_mixing_vials_list.length; id++) {
            vm.commissioning_mixing_vials_list[id] = selected;
        }
    }

    vm.toggleSSM = function(id) {
        if (vm.commissioning_ssm_list[id]) {
            vm.commissioning_ssm_list[id] = false;
        } else {
            vm.commissioning_ssm_list[id] = true;
        }

        vm.allSSMs = true;
        for (var ssm_id=0; ssm_id<vm.commissioning_ssm_list.length; ssm_id++) {
            if (!vm.commissioning_ssm_list[ssm_id]) {
                vm.allSSMs = false;
                break;
            }
        }
    }

    vm.toggleReagent = function(id) {
        if (vm.commissioning_reagent_list[id]) {
            vm.commissioning_reagent_list[id] = false;
        } else {
            vm.commissioning_reagent_list[id] = true;
        }

        vm.allReagents = true;
        for (var reagent_id=0; reagent_id<vm.commissioning_reagent_list.length; reagent_id++) {
            if (!vm.commissioning_reagent_list[reagent_id]) {
                vm.allReagents = false;
                break;
            }
        }
    }

    vm.toggleMixingVial = function(id) {
        if (vm.commissioning_mixing_vials_list[id]) {
            vm.commissioning_mixing_vials_list[id] = false;
        } else {
            vm.commissioning_mixing_vials_list[id] = true;
        }

        vm.allMixingVials= true;
        for (var mixing_vials_id=0; mixing_vials_id<vm.commissioning_mixing_vials_list.length; mixing_vials_id++) {
            if (!vm.commissioning_mixing_vials_list[mixing_vials_id]) {
                vm.allMixingVials= false;
                break;
            }
        }
    }

    vm.run_commissioning_test = function() {
        var args = "";
        var id;
        var ssms = "";
        for (id=0; id<vm.commissioning_ssm_list.length; id++) {
            if (vm.commissioning_ssm_list[id]) {
                if (!ssms.length) {
                    ssms += "--ssms:" + id;
                } else {
                    ssms += "-" + id;
                }
            }
        }
        args += ssms;

        var reagents = "";
        for (id=0; id<vm.commissioning_reagent_list.length; id++) {
            if (vm.commissioning_reagent_list[id]) {
                if (!reagents.length) {
                    reagents += ":--reagents:" + id;
                } else {
                    reagents += "-" + id;
                }
            }
        }
        args += reagents;

        var vials = "";
        for (id=0; id<vm.commissioning_mixing_vials_list.length; id++) {
            if (vm.commissioning_mixing_vials_list[id]) {
                if (!vials.length) {
                    vials += ":--mixingvials:" + id;
                } else {
                    vials += "-" + id;
                }
            }
        }
        args += vials;

        // default test is full test
        if (vm.selected_commissioning_test && vm.selected_commissioning_test !== "full") {
            args += ":--"+vm.selected_commissioning_test;
        }

        vm.is_running_commissioning = true;
        socket.emit('commissioning-commands', args, function(result) {
            vm.is_running_commissioning = false;
        });
    }
    
    vm.check_running_commissioning = function() {
        return vm.is_running_commissioning;
    }

    vm.check_commissioning_test = function() {
        if (vm.selected_commissioning_test === "smoke-test") {
          var id;
          for (id=0; id<vm.commissioning_ssm_list.length; id++) {
              vm.commissioning_ssm_list[id] = false;
          }

          for (id=0; id<vm.commissioning_reagent_list.length; id++) {
              vm.commissioning_reagent_list[id] = false;
          }

          for (id=0; id<vm.commissioning_mixing_vials_list.length; id++) {
              vm.commissioning_mixing_vials_list[id] = false;
          }

          for (id in vm.ssm_smoke_test_default_set) {
              vm.commissioning_ssm_list[vm.ssm_smoke_test_default_set[id]] = true;
          }

          for (id in vm.reagent_smoke_test_default_set) {
              vm.commissioning_reagent_list[vm.reagent_smoke_test_default_set[id]] = true;
          }

          for (id in vm.mixing_vials_smoke_test_default_set) {
              vm.commissioning_mixing_vials_list[vm.mixing_vials_smoke_test_default_set[id]] = true;
          }
        }
    }

    // for mixing vial script
    vm.wash_mixing_vial_fluid = 'DI';
    vm.wash_mixing_vial_fluids = ['DI', 'ALCOHOL'];

    vm.wash_mixing_vials_list = [];
    vm.allWashMixingVials = false;

    for (id=0; id<48; id++) {
        vm.wash_mixing_vials_list[id] = false;
    }

    vm.washMixingVialChecked = function(id) {
        return vm.wash_mixing_vials_list[id];
    }

    vm.toggleAllWashMixingVials = function() {
        var selected = !vm.allWashMixingVials;
        for (var id=0; id<vm.wash_mixing_vials_list.length; id++) {
            vm.wash_mixing_vials_list[id] = selected;
        }
    }

    vm.toggleWashMixingVial = function(id) {
        vm.wash_mixing_vials_list[id] =  !vm.wash_mixing_vials_list[id];

        vm.allWashMixingVials= true;
        for (var mixing_vials_id=0; mixing_vials_id<vm.wash_mixing_vials_list.length; mixing_vials_id++) {
            if (!vm.wash_mixing_vials_list[mixing_vials_id]) {
                vm.allWashMixingVials= false;
                break;
            }
        }
    }

    vm.wash_mixing_vials = function() {

        var vials = "";
        for (id=0; id<vm.wash_mixing_vials_list.length; id++) {
            if (vm.wash_mixing_vials_list[id]) {
                if (!vials.length) {
                    vials += ":--mixingvials:" + id;
                } else {
                    vials += '-' + id;
                }
            }
        }

        vm.run_script(true, 'Washing Mixing Vials', 'runscript~logs~wash_mixing_vials~--fluid:' + vm.wash_mixing_vial_fluid + vials, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    // for empty hydration drain

    vm.empty_hydration_drain = function() {

        vm.run_script(true, 'Emptying Hydration Drain', 'runscript~logs~empty_hydration_drain~', function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });

    }

    // for calibration
    vm.x_offset = 0;
    vm.y_offset = 0;
    vm.x_pos = 0;
    vm.y_pos = 0;
    vm.positions_text = '';
    vm.selected_end_effector = "";
    vm.end_effector_list = [
        "SSMOpener", 
        "BulkFluidProbe1", 
        "BulkFluidProbe2",
        "BulkFluidProbe3", 
        "BulkFluidProbe4", 
        "HVReagentProbe", 
        "BulkFluidProbe5",
        "BulkFluidProbe6", 
        "BulkFluidProbe7", 
        "SlidePickupHead", 
        "UltrasonicDistanceSensor",
        "Camera"]; 

    vm.selected_position = "";
    vm.position_list = [
        "Current",
        "Home",
        "SSM Port",
        "SSM Slide Placement",
        "Wash Point",
        "Reagent Container",
        "Mixing Vial",
        "Slide Input Drawer",
        "Slide Output Drawer",
        "Calibration Post",
        "Camera Viewpoint"];

    vm.select_end_effector = function () {
        if (vm.selected_end_effector) {
            var id = vm.end_effector_list.indexOf(vm.selected_end_effector);
            vm.run_script(true, 'Select end effector', 'runscript~logs~move~EndEffector:'+id, function(run_result) {
                console.log('run_result CALLBACK=', run_result);
            });
        }
    }

    vm.move_to_position = function() {
        if (vm.selected_position) {
            var position_type = vm.position_list.indexOf(vm.selected_position);
            var position_index = vm.selected_position_index
            // the first 2 types don't need index            
            if (position_type <= 1) position_index = 0
            var args = "Position:" + position_type + ":" + position_index; 
            vm.run_script(true, 'Move to position', 'runscript~logs~move~'+args, function(run_result) {
                console.log('run_result CALLBACK=', run_result);
            });
        }
    }

    vm.torque_limit_move = function() {
        if (vm.backoff_steps) {
            var args = "TorqueLimitMove:" + vm.backoff_steps; 
            vm.run_script(true, 'Torque limit move', 'runscript~logs~move~'+args, function(run_result) {
                console.log('run_result CALLBACK=', run_result);
            });
        }
    }

    vm.move_to_safe_height = function() {
        vm.run_script(true, 'Move to safe height', 'runscript~logs~move~SafeHeight', function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    }

    vm.move_with_offset = function() {
        if (vm.x_offset || vm.y_offset) {
            var args = "Relative:" + vm.x_offset*1000 + ':' + vm.y_offset*1000 + ':0'; 
            vm.run_script(false, 'Move with offset', 'runscript~logs~move~'+args, function(run_result) {
                console.log('run_result CALLBACK=', run_result);
                vm.run_script(false, 'Get Position', 'runscript~position-log~get_position~', function(run_result) {
                    console.log(vm.positions_text)
                    var response = vm.get_response_string(vm.positions_text);
                    if (response !== undefined) {
                       var reports = response.reports;
                       vm.x_pos = reports.x;
                       vm.y_pos = reports.y;
                    }
                });
            });
        }
    }

    vm.save_calibrated_position = function() {
        var args='';
        if (vm.selected_end_effector) args += '--endeffector:' + vm.selected_end_effector + ':';
        if (vm.selected_position) args += '--type:' + vm.selected_position + ':';
        if (vm.selected_position_index) args += '--index:' + vm.selected_position_index + ':';
        if (vm.x_offset) args += '--xoffset:' + vm.x_offset + ':';
        if (vm.y_offset) args += '--yoffset:' + vm.y_offset + ':';;
        if (args) {
            vm.run_script(true, 'Save calibrated positions', 'runscript~logs~save_calibration_positions~'+args.substring(0, args.length-1), function(run_result) {
                console.log('run_result CALLBACK=', run_result);
            });
        }
    }

    socket.on('/', function(data) {
        vm.log_text += data + "\r\n"
        setTimeout(
            function( ) {
                $scope.$apply("ctrl.log_text");
            });
    });

    socket.on('logs', function(data) {
        vm.log_text += data + "\r\n";
        vm.log_text_changed = true;
    });

    socket.on('full-logs', function(data) {
        for(var filterIndex in vm.log_error_filters) {
            if(data.indexOf(vm.log_error_filters[filterIndex]) != -1) {
                return;
            }
        }
        vm.log_text_full += data + "\r\n";
        vm.log_text_full_changed = true;
    });

    vm.format_log_text = function() {
        if  (vm.log_text_changed) {
            vm.log_text_changed = false;
            setTimeout(
                function( ) {
                    $scope.$apply("ctrl.log_text");
                });
        }
        if  (vm.log_text_full_changed) {
            vm.log_text_full_changed = false;
            setTimeout(
                function( ) {
                    $scope.$apply("ctrl.log_text_full");
                });
        }
    };

    socket.on('filtered-logs', function(data) {
        vm.log_text_filtered += '\n';
        vm.log_text_filtered += data;
    });

    vm.force_binding_update = function() {
        $scope.$apply(function() { });
    };

    socket.on('temps-log', function(data) {
        vm.update_temperatures_response_text += data;
    });

    socket.on('bottles-log', function(data) {
        vm.update_bottles_response_text += data;
    });

    socket.on('pressure-log', function(data) {
        vm.update_pressures_response_text += data;
    });

    socket.on('mode-log', function(data) {
        vm.mode_response_text += data;
    });

    socket.on('firmware-log', function(data) {
        vm.firmware_response_text += data;
    });

    socket.on('report-log', function(data) {
        vm.update_report_response_text += data;
    });

    socket.on('position-log', function(data) {
        vm.positions_text += data;
    });

    socket.on('lid-log', function(data) {
        vm.lid_lock_state_text += data;
    });

    socket.on('disconnect', function() {
        vm.log_text += "Disconnect from Server" + "\r\n";
        vm.lid_lock_state = 'Unknown';
        vm.lid_class = vm.lid_classes[vm.lid_lock_state];

        $scope.$apply("ctrl.log_text");
    });

    vm.update_temperatures = function() {
        if  (vm.update_temperatures_running) {
            // do not fetch temperatures while the task is running
            return
        }

        if (vm.disable_polling) {
            // do not fetch temperatures while initialising (boards resetting etc.)
            vm.ssm_color = 'yellow';
            // set temperatures to 0 to remove stale data
            for (ssm_id=1; ssm_id<25; ssm_id++) {
                vm.ssms[ssm_id] = {};
                vm.set_temperature(ssm_id, 0);
            }

            return;
        }

        vm.update_temperatures_running = true;
        vm.ssm_color = 'smoke';
        socket.emit('eservice-commands', 'runscript~temps-log~get_ssm_summary~', function(run_result) {
            vm.extract_ssm_temperatures(vm.update_temperatures_response_text);
            vm.update_temperatures_response_text = '';
            vm.update_temperatures_running = false;
        });
    };

    vm.update_pressures = function() {
        if (vm.disable_polling || vm.update_pressures_running) {
            // do not fetch pressures while disable_polling (boards resetting etc.), or while the task is running
            return
        }

        vm.update_pressures_running = true;
        socket.emit('eservice-commands', 'runscript~pressure-log~get_pressure_summary~', function(run_result) {
            vm.extract_pressures(vm.update_pressures_response_text);
            vm.update_pressures_response_text = '';
            vm.update_pressures_running = false;
        });
    };

    vm.update_bottles = function() {
        if (vm.update_bottles_running) {
            // do not fetch pressures while the task is running
            return
        }

        if (vm.disable_polling) {
            vm.bottle_color = 'yellow';
            for (bottle_id=0; bottle_id < vm.bottles.length; bottle_id++) {
                vm.set_bottle_level(bottle_id, 0);
                vm.set_bottle_state(bottle_id, 'Disabled');

            }

            // do not fetch pressures while disable_polling (boards resetting etc.)
            return;
        }

        vm.update_bottles_running = true;
        vm.bottle_color = 'smoke';
        socket.emit('eservice-commands', 'runscript~bottles-log~get_bottles_summary~', function(run_result) {
            vm.extract_bottle_levels(vm.update_bottles_response_text);
            vm.update_bottles_response_text = '';
            vm.update_bottles_running = false;
        });
    };

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

    vm.extract_pressures = function(data) {
        // '...@@RESPONSE@@ {"pressures": {"robot_vacuum_pressure_kPa": -12.127, ...}}@@RESPONSE@@...';
        var response = vm.get_response_string(data);
        if (response !== undefined) {
            var pressures = response.pressures;
            if ('robot_vacuum_pressure_kPa' in pressures) {
                vm.robot_vacuum_pressure_kPa = pressures.robot_vacuum_pressure_kPa;
            }
            if ('robot_vacuum_raw_ADC' in pressures) {
                vm.robot_vacuum_raw_ADC = pressures.robot_vacuum_raw_ADC;
            }
            if ('std_scavenge_pressure_kPa' in pressures) {
                vm.std_scavenge_pressure_kPa = pressures.std_scavenge_pressure_kPa;
            }
            if ('std_scavenge_raw_ADC' in pressures) {
                vm.std_scavenge_raw_ADC = pressures.std_scavenge_raw_ADC;
            }
            if ('haz_scavenge_pressure_kPa' in pressures) {
                vm.haz_scavenge_pressure_kPa = pressures.haz_scavenge_pressure_kPa;
            }
            if ('haz_scavenge_raw_ADC' in pressures) {
                vm.haz_scavenge_raw_ADC = pressures.haz_scavenge_raw_ADC;
            }
            if ('ssm_bank1_scavenge_pressure_kPa' in pressures) {
                vm.ssm_bank1_scavenge_pressure_kPa = pressures.ssm_bank1_scavenge_pressure_kPa;
            }
            if ('ssm_bank1_scavenge_raw_ADC' in pressures) {
                vm.ssm_bank1_scavenge_raw_ADC = pressures.ssm_bank1_scavenge_raw_ADC;
            }
            if ('ssm_bank2_scavenge_pressure_kPa' in pressures) {
                vm.ssm_bank2_scavenge_pressure_kPa = pressures.ssm_bank2_scavenge_pressure_kPa;
            }
            if ('ssm_bank2_scavenge_raw_ADC' in pressures) {
                vm.ssm_bank2_scavenge_raw_ADC = pressures.ssm_bank2_scavenge_raw_ADC;
            }
            if ('main_probe_pressure_kPa' in pressures) {
                vm.main_probe_pressure_kPa = pressures.main_probe_pressure_kPa;
            }
            if ('main_probe_raw_ADC' in pressures) {
                vm.main_probe_raw_ADC = pressures.main_probe_raw_ADC;
            }
            if ('main_robot_er1_pressure_kPa' in pressures) {
                vm.main_robot_er1_pressure_kPa = pressures.main_robot_er1_pressure_kPa;
            }
            if ('main_robot_er1_raw_ADC' in pressures) {
                vm.main_robot_er1_raw_ADC = pressures.main_robot_er1_raw_ADC;
            }

            if ('bulk_valve_haz_scavenge_high_level_state' in pressures) {
                vm.bulk_valve_haz_scavenge_high_level_state = pressures.bulk_valve_haz_scavenge_high_level_state;
            }
        }
    };

    vm.extract_ssm_temperatures = function(data) {
        // '...@@RESPONSE@@ {"ssm_temperatures": {"1": 20.019542694091797, "2": 0, ... , "24": 0}}@@RESPONSE@@...';
        var response = vm.get_response_string(data);
        if (response !== undefined) {
            var temps = response.ssm_temperatures;
            var states = response.ssm_states;
            for (var ssm_id = 1; ssm_id < 25; ssm_id++) {
                var temperature = temps[ssm_id];
                vm.set_temperature(ssm_id, Math.round(temperature * 100) / 100);
                var state = states[ssm_id];
                vm.set_ssm_state(ssm_id, state);
            }
        }
    };

    vm.extract_bottle_levels = function(data) {
       // '...@@RESPONSE@@ {"bottle_levels": {"0": 20.25462, "2": 5.233, ... , "7": 99.5483}}@@RESPONSE@@...';
       var response = vm.get_response_string(data);
       if (response !== undefined) {
            var liquid_levels = response.bottle_levels;
            var bottle_states = response.bottle_states;
            for (var bottle_id = 0; bottle_id < vm.bottles.length; bottle_id++) {
                var liquid_level = liquid_levels[bottle_id];
                vm.set_bottle_level(bottle_id, liquid_level);
                var bottle_state = bottle_states[bottle_id];
                vm.set_bottle_state(bottle_id, bottle_state);
            }
        }

    };

    // command buttons

    vm.run_script = function(show_dialog, script_description, script_param_string, callback) {
        if (show_dialog) { vm.show_script_running(script_description); }
        socket.emit('eservice-commands', script_param_string, function(run_result) {
            callback(run_result);
            if (show_dialog) {
                // wait at least 2 seconds to show dialog
                setTimeout(function(){$mdDialog.hide();}, 2000);
            }
        });
    };

    vm.fill_di = function() {
        vm.run_script(true, 'Filling DI', 'runscript~logs~fill_DI~'+vm.fill_di_duration, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.mix_bw = function(show_dialog) {
        vm.run_script(show_dialog, 'Mixing BW', 'runscript~logs~fill_BW~'+vm.mix_bw_volume, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.shutdown = function() {
        vm.disable_polling = true;  // stop background fetches of pressures and temperatures
        vm.run_script(true, 'Shut down', 'runscript~logs~shutdown~', function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.mini_prime = function() {
        vm.run_script(true, 'Mini-Prime', 'runscript~logs~mini_prime~', function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.initialise = function() {
        vm.disable_polling = true;  // stop background fetching
        // don't run the "actual" initialise unless the other background tasks are completed - if not, run this
        // function again 250ms from now and return
        if (vm.update_bottles_running || vm.update_pressures_running || vm.update_temperatures_running ||
            vm.get_lid_lock_state_running) {
            setTimeout(function(){vm.initialise();}, 250);
            return;
        }
        // don't run initialise while it is already running
        if (vm.initialise_running) {
            return;
        }
        // initialise the instrument
        vm.initialise_running = true;
        vm.run_script(true, 'Initialise', 'runscript~logs~initialise~', function(run_result) {
            vm.initialise_running = false;
            vm.disable_polling = false;
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.recover_motor = function (fluid_type) {
        vm.disable_polling = true;  // stop background fetches of pressures and temperatures
        vm.run_script(true, 'Recovering Motors with '+fluid_type, 'runscript~logs~recover_motor~'+fluid_type, function (run_result) {
            vm.disable_polling = false;
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.calculate_pressure_offset = function() {
        vm.run_script(true, 'Calculating Pressure Offsets', 'runscript~logs~calculate_pressure_offsets~', function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.transfer_waste = function() {
        vm.run_script(true, 'Transferring waste', 'runscript~logs~transfer_waste~'+vm.waste_type+':'+vm.waste_duration, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
            vm.transfer_waste_enabled = true;
        });
    };

    vm.fluid_priming  = function(full) {
        var args;
        if (full) {
            args = full;
        }
        else {
            args = vm.single_prime_line+':'+vm.single_prime_volume;
        }
        vm.run_script(true, 'Priming fluid', 'runscript~logs~fluid_priming~'+args, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.tissue_digestion_mini_prime = function() {
        vm.run_script(true, 'Tissue digestion mini priming', 'runscript~logs~mini_prime_td~'+vm.single_prime_volume, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.set_ssms_to_ambient = function() {
        vm.run_script(true, 'Cooling SSMs to ambient', 'runscript~logs~ssm_ambient~'+vm.selected_ssm, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.open_ssm = function() {
        vm.run_script(true, 'Opening SSM', 'runscript~logs~open_close_ssm~open:'+vm.selected_open_close_ssm, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.close_ssm = function() {
        vm.run_script(true, 'Closing SSM', 'runscript~logs~open_close_ssm~close:'+vm.selected_open_close_ssm, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.scavenge_ssm = function() {
        vm.run_script(true, 'Scavenging SSM', 'runscript~logs~scavenge_ssm~'+vm.selected_scavenge_ssm+':'+vm.ssm_scavenge_duration, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.vent_ssm_bank = function() {
        vm.run_script(true, 'Venting SSM Bank', 'runscript~logs~vent_scavenge_channel~'+vm.selected_vent_bank+':'+vm.bank_vent_duration, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.clear_logs = function() {
        vm.log_text_full = '';
        vm.log_text = '';
        vm.force_binding_update();
    };

    vm.apply_master_mode = function() {
        vm.disable_polling = true;  // stop background fetches when switch mode
        vm.run_script(true, 'Switching Mode', 'runscript~logs~switch_mode~'+vm.master_mode, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.move_hv_probe = function(description, position) {
        vm.run_script(true, description, 'runscript~logs~move~'+position, function(run_result) {
            console.log('run_result CALLBACK=', run_result);
        });
    };

    vm.get_master_mode = function() {
        vm.run_script(false, 'Switching Mode', 'runscript~mode-log~switch_mode~READ', function(run_result) {
            var response = vm.get_response_string(vm.mode_response_text);
            if (response !== undefined) {
                vm.mode_response_text = response['mode'];
                vm.master_mode = vm.mode_response_text;
                vm.mode_response_text = '';
            }
        });
    };

    vm.get_firmware_details = function(show_dialog) {
        vm.firmware_response_text = '';
        vm.run_script(show_dialog, 'Fetching firmware details', 'runscript~firmware-log~get_firmware_details~', function (run_result) {
            console.log('run_result CALLBACK=', run_result);
            var response = vm.get_response_string(vm.firmware_response_text);
            if(response !== undefined) {
                details = '';
                for (var board in response.firmware) {
                    details += board + ': ';
                    details += response.firmware[board].boot_loader_version + '/';
                    details += response.firmware[board].application_version + '\n';
                }
                vm.firmware_details = details;
            }
        });
    };

    vm.range = function(start, end, step, offset) {
        return Array.apply(null, Array((Math.abs(end - start) + ((offset||0)*2))/(step||1)+1))
            .map(function(_, i) { 
                return start < end ? i*(step||1) + start - (offset||0) :  (start - (i*(step||1))) + (offset||0) 
            }) 
    }

    vm.regular_checks = function() {
        // fetch the mode immediately
        vm.get_master_mode();
        vm.check_instrument_config()
    };

    vm.run_advanced_filter = function() {
        vm.log_text_filtered = '';

        if(vm.log_filter_start_time === '') {
            var now = new Date();
            timezoneOffset = now.getTimezoneOffset();
            now = new Date(now - timezoneOffset * 60000);

            //past hour by default
            now = new Date(now - 60000);
            vm.log_filter_start_time = now.toISOString().replace('T', ' ').replace('Z','');
            vm.log_text_filtered += 'No start timestamp specified - defaulting to last minute\n'
        }

        startTime = vm.log_filter_start_time;
        endTime = vm.log_filter_end_time;
        filter = vm.log_filter;

        var parameters = '';

        if (vm.log_filter_start_time !== ''){
            parameters += '--minTime~' + vm.log_filter_start_time + '~';
        }

        if (vm.log_filter_end_time !== ''){
            parameters += '--maxTime~' + vm.log_filter_end_time + '~';
        }

        if (vm.log_filter_query !== ''){
            parameters += '--filter~' + vm.log_filter_query + '~';
        }

        vm.log_text_filtered += 'Filtering with: ' + parameters + '\n';
        vm.log_filter_command_line = parameters.split('~').join(' ');

        socket.emit('filter-logs', parameters, function(run_result) {
            vm.log_text_filtered += run_result;
        });
    };

    vm.clicked_logs = function(clickEvent) {
        //vm.log_text_filtered += "\r\nclicked the logs";
        //vm.log_text_filtered += "\r\n" + clickEvent.pageX + " " + clickEvent.pageY;

        var textArea = clickEvent.target;
        //vm.log_text_filtered += "\r\n" + textArea.id;

        var pos = textArea.selectionStart;
        var contents = textArea.value;
        for(var start = pos; start > 0 && contents[start] !== '\n'; start--)
        {
        }

        for(var end = pos; end < contents.length && contents[end] !== '\n'; end++)
        {
        }

        vm.log_selected_line = contents.substring(start+1, end)
    };

    vm.view_context_around_selected_line = function(range) {
        var timestamp = vm.log_selected_line.substring(0, 23);

        timestamp = timestamp.replace(' ', 'T') + "Z";
        var date = Date.parse(timestamp);
        vm.log_filter_start_time = new Date(date - range * 1000).toISOString().replace('T', ' ').replace('Z','');
        vm.log_filter_end_time = new Date(date + range * 1000).toISOString().replace('T', ' ').replace('Z','');
    };

    vm.send_timestamps_to_status_tracking = function(range) {
        //TODO: Implement this
    };

    vm.reconstruct_advanced_query = function() {
        if(vm.log_context_filters.length == 0){
            vm.log_filter_query = 'Level("INFO")';
        } else if (vm.log_context_filters.length == 1){
            vm.log_filter_query = vm.log_context_filters[0];
        } else {
            vm.log_filter_query = "Or(" + vm.log_context_filters.join(",") + ")";
        }
    };

    vm.reconstruct_advanced_query();

    vm.add_context_filter = function() {
        //TODO: Escape these?
        var source = vm.log_new_filter_source;
        var level = vm.log_new_filter_level;
        var match = vm.log_new_filter_match;
        var isRegex = vm.log_new_filter_regex;

        var activeConditions = [];

        activeConditions.push('Level("' + level + '")')

        if(match !== '') {
            if(isRegex) {
                activeConditions.push('Regex("' + match + '")')
            } else {
                activeConditions.push('Match("' + match + '")')
            }
        }

        if(source !== '') {
            activeConditions.push('Source("' + source + '")')
        }

        var filter = ''
        if(activeConditions.length == 1){
            filter = activeConditions[0];
        } else {
            filter = "And(" + activeConditions.join(",") + ")";
        }

        vm.reset_new_context_filter_input()

        if(vm.log_context_filters.indexOf(filter) === -1) {
            vm.log_context_filters.push(filter)
        }

        vm.reconstruct_advanced_query()
    };

    vm.remove_context_filter = function(filter) {
        var index = vm.log_context_filters.indexOf(filter);
        vm.log_context_filters.splice(index, 1);
        vm.reconstruct_advanced_query();
    };

    vm.hide_errors_matching_selection = function() {
        var textArea = document.getElementById("log-selected-line");
        var start = textArea.selectionStart;
        var end = textArea.selectionEnd;

        var newFilter = vm.log_selected_line.substring(start, end);
        if(start == end)
        {
            textArea = document.getElementById("log-area-full");
            start = textArea.selectionStart;
            end = textArea.selectionEnd;

            newFilter = textArea.value.substring(start, end);
            if(start == end)
            {
                return
            }
        }

        if(vm.log_error_filters.indexOf(newFilter) == -1) {
            vm.log_error_filters.push(newFilter);
            var lines = vm.log_text_full.split('\n');
            var newLines = [];
            for(var lineIndex in lines) {
                var line = lines[lineIndex];
                if(line.indexOf(newFilter) == -1) {
                    newLines.push(line);
                }
            }
            vm.log_text_full = newLines.join('\n');
        }
    };

    vm.remove_error_filter = function(filter) {
        var index = vm.log_error_filters.indexOf(filter);
        vm.log_error_filters.splice(index, 1);
    };

    vm.get_lid_lock_state = function() {
        if (vm.disable_polling || vm.get_lid_lock_state_running) {
            // do not fetch lid lock state while disable_polling (boards resetting etc.), or while the task is running
            return;
        }

        vm.get_lid_lock_state_running = true;
        vm.lid_lock_state_text = '';
        vm.run_script(false, 'Fetching lid state', 'runscript~lid-log~get_lid_state~', function (run_result) {
            //console.log('run_result CALLBACK=', run_result);
            var response = vm.get_response_string(vm.lid_lock_state_text);
            vm.lid_lock_state = 'Unknown';
            if(response !== undefined) {
                if (response.reports == 0) {
                    vm.lid_lock_state = 'Open';
                } else if (response.reports == 1) {
                    vm.lid_lock_state = 'Closed';
                }
            }
            vm.lid_class = vm.lid_classes[vm.lid_lock_state];
        });
        vm.get_lid_lock_state_running = false;
    };

    // fetch the mode, firmware details and lid state immediately
    vm.regular_checks();
    vm.get_firmware_details(false);
    vm.get_lid_lock_state();

    $interval(vm.update_bottles, 5000)
    $interval(vm.update_temperatures, 2000);
    $interval(vm.update_pressures, 2000);
    $interval(vm.regular_checks, 10000);
    $interval(vm.get_lid_lock_state, 5000);
    $interval(vm.format_log_text, 1000);
});
