import sys
import os.path
import datetime
import time
import thermo_utility
from Board import Board

DURATION = 60 # Seconds

# store number of readings before writing to file
buffer = []
board = Board.getInstance()
tick = None

def save_to_file():
    global buffer
    if len(buffer) < 10:
        buffer.append(str(datetime.datetime.now()) + ","+str(board.get_filtered_temperature())+","+str(thermo_utility.send_get_target())+"\n")
    else:
        f = open(os.path.join(thermo_utility.get_project_root_path(), thermo_utility.TEMPERATURE_LOG_FILE_PATH), "a")
        for item in buffer:
            f.write(item)
        buffer = []
        f.close()

def save_to_db(db_manager):
    try:
        db_manager.insert_one({'timestamp':str(datetime.datetime.now()), 'temperature':board.get_filtered_temperature(),'target':thermo_utility.send_get_target()})
    except Exception as exception:
        thermo_utility.write_to_error_log("Exception: {}-{}-{}\n".format(datetime.datetime.now(), 'save_to_db', exception))

def check_command(db_manager):
    try:
        commands = db_manager.get_all_commands()
        for command in commands:
            if command['command'] == 'set':
                thermo_utility.send("--target:" + str(int(command['value'])))
            elif command['command'] == 'addtimer':
                thermo_utility.send("--addtimer:" + str(int(command['value'])))
            elif command['command'] == 'deltimer':
                thermo_utility.send("--deltimer:" + str(int(command['value'])))
        db_manager.delete_all_commands()
        # if commands and \
        #         abs(datetime.datetime.strptime(command['timestamp'], "%Y-%m-%d %H:%M:%S.%f") - tick).total_seconds()<DURATION:
        #     if command['command'] == 'set':
        #         thermo_utility.send("--target:" + str(int(command['value'])))
    except Exception as exception:
        thermo_utility.write_to_error_log("Exception: {}-{}-{}\n".format(datetime.datetime.now(), 'save_to_db', exception))


def main():
    db_manager = None
    if thermo_utility.TEMPERATURE_RECORDS_FROM_DB:
        db_manager = thermo_utility.connect_db()
    while True:
        if thermo_utility.TEMPERATURE_RECORDS_FROM_LOG:
            save_to_file()
        if thermo_utility.TEMPERATURE_RECORDS_FROM_DB and db_manager:
            global tick
            tick = datetime.datetime.utcnow()
            save_to_db(db_manager)
            check_command(db_manager)
        time.sleep(DURATION)
    return 2

if __name__ == "__main__":
    sys.exit(main())
