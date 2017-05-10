import Adafruit_BBIO.ADC as ADC
import os.path

# Temperature senor:TI TMP36
TMP_SENSOR_INPUT_PIN = 'P9_40'
GPIO_FILE_PATH  = "/sys/class/gpio/gpio60/value"

TEMPERATURE_LOG_FILE_PATH = "/root/Code/thermo_control/python-scripts/temperature.log"
LOCAL_PORT = "9001"
LOCAL_ADDRESS = "tcp://127.0.0.1" + ":" + LOCAL_PORT

def get_temperatures():
    ADC.setup()
    reading = ADC.read(TMP_SENSOR_INPUT_PIN)
    millivolts = reading * 1800  # 1.8V reference = 1800 mV
    temp_c = (millivolts - 500) / 10
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