import sys
import argparse
import os.path
import datetime
import zmq
import thermo_utility

SETTING_FILE_PATH = "/root/Code/thermo_control/python-scripts/settings.cfg"

def parse_date(date_string):
    return datetime.datetime.strptime(date_string, "%Y-%m-%d %H:%M:%S.%f")

def send(message):
    context = zmq.Context()
    sock = context.socket(zmq.REQ)
    sock.connect(thermo_utility.LOCAL_ADDRESS)
    sock.send(message)
    return sock.recv()

def send_target(message):
    reponse = send("--target:" + message)
    # print reponse

def send_set(message):
    reponse = send("--set:" + message)
    # print reponse

def send_del(message):
    reponse = send("--delete:" + message)
    # print reponse

def send_get_target():
    reponse = send("--get")
    return reponse

def get_plot(required_lines):
    target = send_get_target()

    if not os.path.exists(thermo_utility.TEMPERATURE_LOG_FILE_PATH):
        return False
    f = open(thermo_utility.TEMPERATURE_LOG_FILE_PATH, 'r')
    lines = f.readlines()
    start_line = 0
    if len(lines) > required_lines:
        start_line = len(lines) - required_lines
    line_number = 0
    items = []
    for line in lines:
        if line_number < start_line:
            line_number += 1
            continue
        item = {}
        line = line.split(",")
        date = parse_date(line[0])
        t = line[1]
        item["timestamp"] = str(date.hour) + ":" + str(date.minute)
        item["temp"] = t
        item["target"] = target
        items.append(item)
    f.close()
    return  items

def send_get_timers():
    reponse = send("--gettimers")
    return reponse

def main():
    # f = open("./log", 'a')
    # for a in sys.argv:
    #     f.write(a + "\n")
    # f.close()
    # set format: --set:T-H-M  17-07-01(17 degree at 7:01)
    # del format: --del:T-H-M or T
    argParser = argparse.ArgumentParser()
    argParser.add_argument('--get', dest="get", action="store_true", help="Get current temperature")
    argParser.add_argument('--plot', dest="plot", action="store", help="Get plot")
    argParser.add_argument('--gettimers', dest="timers", action="store_true", help="Get timers")
    argParser.add_argument('--set', dest="set", action="store", help="Set temperature with time")
    argParser.add_argument('--target', dest="target", action="store", help="Set temperature")
    argParser.add_argument('--delete', help="Delete temperature")

    args = argParser.parse_args()
    get_temp = args.get
    plotting = args.plot
    set_temp = args.set
    target_temp = args.target
    del_temp = args.delete
    get_timers = args.timers

    if get_temp:
        print '@@RESPONSE@@', {"temperature" : thermo_utility.get_temperatures(), "target":send_get_target()}, '@@RESPONSE@@'
    if plotting:
        print '@@RESPONSE@@', get_plot(int(plotting)), '@@RESPONSE@@'
    if target_temp:
        send_target(target_temp)
    if set_temp:
        # skip parameter validation
        send_set(set_temp)
    if del_temp:
        send_del(del_temp)
    if get_timers:
        print '@@RESPONSE@@', send_get_timers(), '@@RESPONSE@@'

if __name__ == "__main__":
    sys.exit(main())
