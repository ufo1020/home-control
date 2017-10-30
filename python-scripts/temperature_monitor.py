import sys
import os.path
import datetime
import time
import thermo_utility


DURATION = 60 # Seconds
ITEMS_OF_A_DAY = 1440 # 24 * 60 * 60 / DURATION
MAX_DAYS = 5
# store number of readings before writing to file
buffer = []

def save_to_file():
    #if cycles >= ITEMS_OF_A_DAY * MAX_DAYS:
    #    f = open(thermo_utility.TEMPERATURE_LOG_FILE_PATH, "r+")
    #    lines = f.readlines()
    #    # only left last N lines
    #    lines = lines[len(lines) - ITEMS_OF_A_DAY * MAX_DAYS:]
    #    f.seek(0)
    #    f.writelines(lines)
    #    f.truncate()
    #    f.close()
    #else:
    global buffer
    if len(buffer) < 10:
        buffer.append(str(datetime.datetime.now()) + ","+str(thermo_utility.get_filtered_temperature())+","+str(thermo_utility.send_get_target())+"\n")
    else:
        f = open(thermo_utility.TEMPERATURE_LOG_FILE_PATH, "a")
        for item in buffer:
            f.write(item)
        buffer = []
        f.close()

def main():
    #f = open(thermo_utility.TEMPERATURE_LOG_FILE_PATH, "w")
    #f.close()
    while True:
        save_to_file()
        time.sleep(60)
    return 2

if __name__ == "__main__":
    sys.exit(main())
