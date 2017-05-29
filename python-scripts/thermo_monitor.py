import sys
import os.path
import datetime
import time
import zmq
import thermo_utility
import threading

g_target_temperature = 0
g_target_temperature_list = []

SETTLING_BUFFER_C = 1
MONITOR_TIMEOUT_S = 60
ON = "1"
OFF = "0"
MAX_SET_TEMPERATURE = 30
MIN_SET_TEMPERATURE = 7

class comms_thread(threading.Thread):
    def __init__(self, thread_id, name):
        threading.Thread.__init__(self)
        self.daemon = True
        self.thread_id = thread_id
        self.name = name
        # ZMQ setup
        self.context = zmq.Context()
        # Define the socket using the "Context"
        self.sock = self.context.socket(zmq.REP)
        self.sock.bind(thermo_utility.LOCAL_ADDRESS)

    def listening(self):
        while True:
            message = self.sock.recv()
            result = self.handle_message(message)
            if result == None:
                result = ""
            self.sock.send(str(result))
            # print "Echo: " + str(result)

    def is_temperature_valid(self, temperature):
        return MIN_SET_TEMPERATURE <= temperature < MAX_SET_TEMPERATURE

    def is_time_valid(self, h, m):
        return 0 <= h <24 and 0<= m < 60

    def handle_message(self, message):
        # input format: 
        # --set:20-07-00
        # --delete:2-3-4 
        # --target:14 
        # --get : get target temperature
        contents = message.split(":")
        if (len(contents) < 1):
            return
        command = contents[0]

        global g_target_temperature
        global g_target_temperature_list;

        if command == "--target":
            temperature = int(contents[1])
            if self.is_temperature_valid(temperature):
                if temperature != g_target_temperature:
                    g_target_temperature = temperature
        elif command == "--set":
            args = contents[1].split("-")
            if len(args) is not 3:
                return
            temperature = int(args[0])
            time_h = int(args[1])
            time_m = int(args[2])
            if not self.is_temperature_valid(temperature):
                return
            if not self.is_time_valid(time_h, time_m):
                return

            next_timer = datetime.time(time_h, time_m)
            now = datetime.datetime.now()
            now_time = now.time()

            # always looking for future time, for example, now is 22:00, next is 07:00
            # now > next
            if now_time > next_timer:
                tmw = datetime.date.today() + datetime.timedelta(days=1)
                next_timer = datetime.datetime(tmw.year, tmw.month, tmw.day, time_h, time_m)
            else:
                next_timer = datetime.datetime(now.year, now.month, now.day, time_h, time_m)
            # g_next_timer_countdown = (next_timer - now).seconds / MONITOR_TIMEOUT_S
            g_target_temperature_list.append({'time':next_timer, 'temp':temperature})
        elif command == "--delete":
            args = contents[1].split("-")
            if len(args) is not 3:
                return
        elif command == "--get":
            return g_target_temperature

        print "set target:" + str(g_target_temperature)

    def run(self):
        self.listening()

class control_thread(threading.Thread):
    def __init__(self, thread_id, name):
        threading.Thread.__init__(self)
        self.daemon = True
        self.thread_id = thread_id
        self.name = name
        self.heater_state = ON if thermo_utility.get_switch_state() else OFF

    def monitoring(self):
        global g_target_temperature
        global g_target_temperature_list

        if len(g_target_temperature_list) > 0:
            next_timer = g_target_temperature_list[0]['time']
            if datetime.datetime.now() > next_timer:
                g_target_temperature = g_target_temperature_list[0]['temp']
                g_target_temperature_list.pop(0)
                print "triggered, new target is: " + str(g_target_temperature)
        # print g_target_temperature_list
        # if g_next_timer_valid:
        #     print "g_next_timer_countdown: " + str(g_next_timer_countdown)
        #     if g_next_timer_countdown > 0:
        #         g_next_timer_countdown -= 1
        #     elif g_next_timer_countdown == 0:
        #         g_target_temperature = g_next_temperature
        #         print "triggered, new target is: " + str(g_target_temperature)
        #         g_next_timer_valid = False

        current_temperature = float(thermo_utility.get_temperatures())
        if current_temperature + SETTLING_BUFFER_C < g_target_temperature:
            if (self.heater_state != ON):
                self.heater_state = ON
                thermo_utility.set_switch(self.heater_state)
        elif current_temperature > g_target_temperature + SETTLING_BUFFER_C:
            if (self.heater_state != OFF):
                self.heater_state = OFF
                thermo_utility.set_switch(self.heater_state)
        print "heater: " + str(self.heater_state) + " temp:" + str(current_temperature) + " target:" + str(g_target_temperature)

    def run(self):
        # print "Starting " + self.name
        while True:
            self.monitoring()
            time.sleep(MONITOR_TIMEOUT_S)
        # print "Exiting " + self.name

def main():
    commsThread = comms_thread(1, "comms_thread")
    controlThread = control_thread(2, "control_thread")

    commsThread.start()
    controlThread.start()
    while True:
        time.sleep(1)

if __name__ == "__main__":
    sys.exit(main())
