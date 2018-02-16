import os.path
import zmq
import time
import json
from db_manager import DBManager

# Temperature senor:TI TMP36
TMP_SENSOR_INPUT_PIN = 'P9_40'
TMP_SENSOR_ADC_INPUT_PATH = '/sys/bus/iio/devices/iio:device0/in_voltage1_raw'
MAX_ADC_RAW_VALUE_OUTPUT = 4096

GPIO_FILE_PATH  = "/sys/class/gpio/gpio60/value"

TEMPERATURE_LOG_FILE_PATH = "/home/debian/home-control/python-scripts/temperature.log"
LOCAL_PORT = "9001"
LOCAL_ADDRESS = "tcp://127.0.0.1" + ":" + LOCAL_PORT

DB_CONFIGURATION_PATH = "/home/debian/home-control/db_config.json"

TEMPERATURE_RECORDS_FROM_LOG = True
TEMPERATURE_RECORDS_FROM_DB = True

def send(message):
    context = zmq.Context()
    sock = context.socket(zmq.REQ)
    sock.connect(LOCAL_ADDRESS)
    sock.send(message)
    return sock.recv()

def send_get_target():
    reponse = send("--get")
    return reponse

def get_temperatures():
    if not os.path.exists(TMP_SENSOR_ADC_INPUT_PATH):
        return 0

    f = open(TMP_SENSOR_ADC_INPUT_PATH, 'r')
    reading = int(f.read())
    millivolts = (float(reading)/float(MAX_ADC_RAW_VALUE_OUTPUT)) * 1800  # 1.8V reference = 1800 mV
    temp_c = (millivolts - 500) / 10
    return "%.1f" % temp_c

def get_filtered_temperature():
    num_of_samples = 10
    samples = []
    for i in range(num_of_samples):
        t = float(get_temperatures())
        samples.append(t)
        time.sleep(0.5)
    samples.sort()
    # remove min/max and average
    # print samples
    samples.pop(0)
    samples.pop()
    temp_c = sum(samples) / float(len(samples))
    return "%.1f" % temp_c

def get_switch_state():
    if not os.path.exists(GPIO_FILE_PATH):
        return False
    f = open(GPIO_FILE_PATH, 'r')
    value = f.read()
    f.close()
    if len(value) != 1:
        return False
    if value == "1":
        return True
    else:
        return False

def set_switch(value):
    if int(value) not in [0, 1]:
        return
    if not os.path.exists(GPIO_FILE_PATH):
        return
    f = open(GPIO_FILE_PATH, 'w')
    f.write(value)
    f.close()

def connect_db():
    f = open(DB_CONFIGURATION_PATH, 'r')
    json_obj = json.load(f)
    return DBManager(json_obj)