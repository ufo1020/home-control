import sys
import argparse
import os.path
import datetime
import gevent
import thermo_utility

def parse_date(date_string):
    return datetime.datetime.strptime(date_string, "%Y-%m-%d %H:%M:%S.%f")

def send_target(message):
    thermo_utility.send("--target:" + message)

def send_add_timer(message):
    thermo_utility.send("--addtimer:" + message)

def send_del_timer(message):
    thermo_utility.send("--deltimer:" + message)

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
            item["temperature"] = t
            item["target"] = target
            items.append(item)
        except:
            continue
    f.close()
    return items

def get_plot_from_db(number_of_records):
    items = []
    with gevent.Timeout(thermo_utility.TIMTOUT):
        db = thermo_utility.connect_db()
        records = db.get_last_number_of_records(number_of_records)
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
    reponse = thermo_utility.send("--gettimers", recv=True)
    return reponse

def main():
    try:
        # set format: --set:T-H-M  17-07-01(17 degree at 7:01)
        # del format: --del:T-H-M or T
        argParser = argparse.ArgumentParser()
        argParser.add_argument('--get', dest="get", action="store_true", help="Get current temperature")
        argParser.add_argument('--plot', dest="plot", action="store", help="Get plot")
        argParser.add_argument('--gettimers', dest="timers", action="store_true", help="Get timers")
        argParser.add_argument('--addtimer', dest="addtimer", action="store", help="Add a timer")
        argParser.add_argument('--deltimer', dest="deltimer", action="store", help="Remove a timer")
        argParser.add_argument('--target', dest="target", action="store", help="Set temperature")
        argParser.add_argument('--delete', help="Delete temperature")

        args = argParser.parse_args()
        get_temp = args.get
        plotting = args.plot
        target_temp = args.target
        get_timers = args.timers
        addtimer = args.addtimer
        deltimer = args.deltimer

        if get_temp:
            print '@@RESPONSE@@', {"temperature" : thermo_utility.get_temperatures(), "target":thermo_utility.send_get_target()}, '@@RESPONSE@@'
        if plotting:
            print '@@RESPONSE@@', get_plot(int(plotting)), '@@RESPONSE@@'
        if target_temp:
            send_target(target_temp)
            print '@@RESPONSE@@', {"temperature": thermo_utility.get_temperatures(),
                                   "target": thermo_utility.send_get_target()}, '@@RESPONSE@@'
        if addtimer:
            # skip parameter validation
            send_add_timer(addtimer)
        if deltimer:
            send_del_timer(deltimer)
        if get_timers:
            print '@@RESPONSE@@', send_get_timers(), '@@RESPONSE@@'
    except Exception as exception:
        thermo_utility.write_to_error_log("Exception: {}-{}\n".format(datetime.datetime.now(), exception))

if __name__ == "__main__":
    sys.exit(main())

