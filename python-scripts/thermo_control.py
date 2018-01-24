import sys
import argparse
import os.path
import datetime
import thermo_utility

def parse_date(date_string):
    return datetime.datetime.strptime(date_string, "%Y-%m-%d %H:%M:%S.%f")

def send_target(message):
    reponse = thermo_utility.send("--target:" + message)
    # print reponse

def send_set(message):
    reponse = thermo_utility.send("--set:" + message)
    # print reponse

def send_del(message):
    reponse = thermo_utility.send("--delete:" + message)
    # print reponse

def get_plot_from_log(number_of_records):
    if not os.path.exists(thermo_utility.TEMPERATURE_LOG_FILE_PATH):
        return None
    f = open(thermo_utility.TEMPERATURE_LOG_FILE_PATH, 'r')
    lines = f.readlines()
    start_line = 0
    if len(lines) > number_of_records:
        start_line = len(lines) - number_of_records
    line_number = 0
    items = []
    for line in lines:
        try:
            if line_number < start_line:
                line_number += 1
                continue
            item = {}
            line = line.split(",")
            assert len(line) == 3, "a line should have 3 fields not %d" % len(line)

            date = parse_date(line[0])
            t = line[1].rstrip()
            target = line[2].rstrip()
            item["timestamp"] = date.isoformat()
            # item["timestamp"] = str(date.hour) + ":" + str(date.minute)
            item["temp"] = t
            item["target"] = target
            items.append(item)
        except:
            continue
    f.close()
    return items

def get_plot_from_db(number_of_records):
    db = thermo_utility.connect_db()
    records = db.get_last_number_of_records(number_of_records)
    items = []
    for record in records:
        items.append(record)
    return items

def get_plot(number_of_records):
    # get records from DB if possible
    records = None
    if thermo_utility.TEMPERATURE_RECORDS_FROM_DB:
        records = get_plot_from_db(number_of_records)
    elif thermo_utility.TEMPERATURE_RECORDS_FROM_LOG:
        records = get_plot_from_log(number_of_records)
    return records

def send_get_timers():
    reponse = thermo_utility.send("--gettimers")
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
        print '@@RESPONSE@@', {"temperature" : thermo_utility.get_temperatures(), "target":thermo_utility.send_get_target()}, '@@RESPONSE@@'
    if plotting:
        print '@@RESPONSE@@', get_plot(int(plotting)), '@@RESPONSE@@'
    if target_temp:
        send_target(target_temp)
        print '@@RESPONSE@@', {"temperature": thermo_utility.get_temperatures(),
                               "target": thermo_utility.send_get_target()}, '@@RESPONSE@@'
    if set_temp:
        # skip parameter validation
        send_set(set_temp)
    if del_temp:
        send_del(del_temp)
    if get_timers:
        print '@@RESPONSE@@', send_get_timers(), '@@RESPONSE@@'

if __name__ == "__main__":
    sys.exit(main())
