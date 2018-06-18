import sys
import os.path
import datetime
import time
import thermo_utility


DURATION = 60 # Seconds

# store number of readings before writing to file
buffer = []

def save_to_file():
    global buffer
    if len(buffer) < 10:
        buffer.append(str(datetime.datetime.now()) + ","+str(thermo_utility.get_filtered_temperature())+","+str(thermo_utility.send_get_target())+"\n")
    else:
        f = open(thermo_utility.TEMPERATURE_LOG_FILE_PATH, "a")
        for item in buffer:
            f.write(item)
        buffer = []
        f.close()

def save_to_db(db_manager):
    try:
        db_manager.insert_one({'timestamp':str(datetime.datetime.now()), 'temperature':thermo_utility.get_filtered_temperature(),'target':thermo_utility.send_get_target()})
    except Exception as exception:
        thermo_utility.write_to_error_log("Exception: {}-{}\n".format(datetime.datetime.now(), exception))

def main():
    db_manager = None
    if thermo_utility.TEMPERATURE_RECORDS_FROM_DB:
        db_manager = thermo_utility.connect_db()
    while True:
        if thermo_utility.TEMPERATURE_RECORDS_FROM_LOG:
            save_to_file()
        if thermo_utility.TEMPERATURE_RECORDS_FROM_DB and db_manager:
            save_to_db(db_manager)
        time.sleep(DURATION)
    return 2

if __name__ == "__main__":
    sys.exit(main())
