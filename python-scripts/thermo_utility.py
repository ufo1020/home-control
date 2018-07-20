import os.path
import zmq
import time
import json
import datetime
import gevent
from db_manager import DBManager

# path is relative to project root path
TEMPERATURE_LOG_FILE_PATH = "python-scripts/temperature.log"
DB_CONFIGURATION_PATH = "db_config.json"
ERROR_LOG_PATH = "python-scripts/error.log"

LOCAL_PORT = "9001"
LOCAL_ADDRESS = "tcp://127.0.0.1" + ":" + LOCAL_PORT

TEMPERATURE_RECORDS_FROM_LOG = True
TEMPERATURE_RECORDS_FROM_DB = False

TIMTOUT = 10 #seconds

def send(message, recv = False, timeout=TIMTOUT):
    context = zmq.Context()
    sock = context.socket(zmq.REQ)
    sock.connect(LOCAL_ADDRESS)
    sock.send(message)
    if recv:
        response = None
        with gevent.Timeout(timeout):
            response = sock.recv()
        return response

def send_get_target():
    return send("--getTarget", recv=True)

def send_get_current():
    return send("--getCurrent", recv=True)

def get_project_root_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

def connect_db():
    f = open(os.path.join(get_project_root_path(), DB_CONFIGURATION_PATH), 'r')
    json_obj = json.load(f)
    return DBManager(json_obj)

def get_next_datetime(timer):
    """Get the repeated timer next day.
    Arguments:
    timer -- datetime.time type
    Return datetime.time
    """
    now = datetime.datetime.now()
    # always looking for future time, for example, now is 22:00, next is 07:00
    # now > next
    if now.time() > timer:
        tmw = datetime.date.today() + datetime.timedelta(days=1)
        timer = datetime.datetime(tmw.year, tmw.month, tmw.day, timer.hour, timer.minute)
    else:
        timer = datetime.datetime(now.year, now.month, now.day, timer.hour, timer.minute)
    return timer

def write_to_error_log(line):
    f = open(os.path.join(get_project_root_path() ,ERROR_LOG_PATH), "a")
    f.write(line)
    f.close()
