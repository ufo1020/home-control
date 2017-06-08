import sys
import os.path
import datetime
import time
import thermo_utility


DURATION = 60 # Seconds
ITEMS_OF_A_DAY = 1440 # 24 * 60 * 60 / DURATION
MAX_DAYS = 5


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
    f = open(thermo_utility.TEMPERATURE_LOG_FILE_PATH, "a")
    f.write(str(datetime.datetime.now()) + ","+str(thermo_utility.get_temperatures())+","+str(thermo_utility.send_get_target())+"\n")
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
