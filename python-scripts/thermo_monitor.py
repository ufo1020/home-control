import sys
import datetime
import time
import zmq
import thermo_utility
import threading
from Board import Board

g_target_temperature = 0
g_target_temperature_list = []

SETTLING_BUFFER_UP_C = 0.2
SETTLING_BUFFER_DOWN_C = 0.5

MONITOR_TIMEOUT_S = 60
ON = "1"
OFF = "0"
MAX_SET_TEMPERATURE = 30
MIN_SET_TEMPERATURE = 7

class comms_thread(threading.Thread):
    def __init__(self, thread_id, name, board):
        threading.Thread.__init__(self)
        self._daemon = True
        self._thread_id = thread_id
        self._name = name
        # ZMQ setup
        self._context = zmq.Context()
        # Define the socket using the "Context"
        self._sock = self._context.socket(zmq.REP)
        self._sock.bind(thermo_utility.LOCAL_ADDRESS)
        self._board = board

    def listening(self):
        while True:
            message = self._sock.recv()
            result = self.handle_message(message)
            if result == None:
                result = ""
            self._sock.send(str(result))
            # print "Echo: " + str(result)

    def is_temperature_valid(self, temperature):
        return MIN_SET_TEMPERATURE <= temperature < MAX_SET_TEMPERATURE

    def is_time_valid(self, h, m):
        return 0 <= h <24 and 0<= m < 60

    def handle_message(self, message):
        # input format:
        # --addtimer:20-07-00-0
        # --deltimer:18-44
        # --target:14
        # --getTarget : get target temperature
        # --getCurrent : get current temperature
        contents = message.split(":")
        if (len(contents) < 1):
            return
        command = contents[0]

        global g_target_temperature
        global g_target_temperature_list

        if command == "--target":
            temperature = int(contents[1])
            if self.is_temperature_valid(temperature):
                if temperature != g_target_temperature:
                    g_target_temperature = temperature
        elif command == "--addtimer":
            args = contents[1].split("-")
            if len(args) is not 4:
                return
            temperature = int(args[0])
            time_h = int(args[1])
            time_m = int(args[2])
            repeat = int(args[3])
            if not self.is_temperature_valid(temperature):
                return
            if not self.is_time_valid(time_h, time_m):
                return
            next_timer = datetime.time(time_h, time_m)
            # make sure there is not duplication
            duplicate = False
            for item in g_target_temperature_list:
                if item['time'].time() == next_timer:
                    duplicate = True
            if not duplicate:
                g_target_temperature_list.append({'time':thermo_utility.get_next_datetime(next_timer), 'temp':temperature, 'repeat':repeat})
        elif command == "--deltimer":
            args = contents[1].split("-")
            if len(args) is not 2:
                return
            time_h = int(args[0])
            time_m = int(args[1])
            for timer in g_target_temperature_list:
                if timer['time'].minute == time_m and timer['time'].hour == time_h:
                    g_target_temperature_list.remove(timer)
        elif command == "--getTarget":
            return g_target_temperature
        elif command == "--getCurrent":
            return self._board.get_catched_temperature()
        elif command == "--gettimers":
            timers = []
            for item in g_target_temperature_list:
                timers.append({'time':item['time'].strftime("%H:%M"), 'temp':item['temp'], 'repeat': item['repeat']})
            return timers

    def run(self):
        self.listening()

class control_thread(threading.Thread):
    def __init__(self, thread_id, name, board):
        threading.Thread.__init__(self)
        self._daemon = True
        self._board = board
        self._thread_id = thread_id
        self._name = name
        self._heater_state = ON if board.get_switch_state() else OFF

    def monitoring(self):
        global g_target_temperature
        global g_target_temperature_list

        now = datetime.datetime.now()
        for timer in g_target_temperature_list:
            # print "now {}, timer {} {}".format(now, timer['time'], timer['repeat'])
            if timer['time'] <= now:
                # if timer['time'].minute == now.minute and timer['time'].hour == now.hour:
                # A timer matches with current time, set temperature
                g_target_temperature = timer['temp']
                # print "triggered, new target is: " + str(g_target_temperature)
                if not timer['repeat']:
                    g_target_temperature_list.remove(timer)
                else:
                    timer['time'] = thermo_utility.get_next_datetime(timer['time'].time())
                # break

        current_temperature = float(self._board.get_catched_temperature())
        if current_temperature + SETTLING_BUFFER_DOWN_C < g_target_temperature:
            if self._heater_state != ON:
                self._heater_state = ON
                self._board.set_switch(self._heater_state)
        elif current_temperature > g_target_temperature + SETTLING_BUFFER_UP_C:
            if self._heater_state != OFF:
                self._heater_state = OFF
                self._board.set_switch(self._heater_state)
        # print "heater: " + str(self.heater_state) + " temp:" + str(current_temperature) + " target:" + str(g_target_temperature)

    def run(self):
        while True:
            self.monitoring()
            time.sleep(MONITOR_TIMEOUT_S)

def main():
    try:
        board = Board.getInstance()
        commsThread = comms_thread(1, "comms_thread", board)
        controlThread = control_thread(2, "control_thread", board)

        commsThread.start()
        controlThread.start()
        while True:
            time.sleep(1)
    except Exception as exception:
        thermo_utility.write_to_error_log("Exception: {}-{}\n".format(datetime.datetime.now(), exception))

if __name__ == "__main__":
    sys.exit(main())
