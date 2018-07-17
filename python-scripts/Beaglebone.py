#!/usr/bin/python

from TMP36 import TMP36
import platform

class Beaglebone(object):
    """Beaglebone specific settings which includes ADC pins, GPIOs etc.
    TMP36 connects to Board as:
        VDD: P9_3 3.3v, Output: P9_40 AIN1
    GPIO_60(Pin P9_12) is used as digital output"""

    ADC_MAX_VOLTAGE = 1800 #mV
    TMP_SENSOR_INPUT_PIN = 'P9_40'
    TMP_SENSOR_ADC_INPUT_PATH = '/sys/bus/iio/devices/iio:device0/in_voltage1_raw'
    MAX_ADC_RAW_VALUE_OUTPUT = 4096

    GPIO_FILE_PATH = "/sys/class/gpio/gpio60/value"

    def __init__(self):
        # make sure it's the right board
        assert ("beaglebone" in platform.uname())
        self._tmp_sensor = TMP36(max_voltage = Beaglebone.ADC_MAX_VOLTAGE, max_adc_value = Beaglebone.MAX_ADC_RAW_VALUE_OUTPUT)

    def get_temperature(self):
        if not os.path.exists(Beaglebone.TMP_SENSOR_ADC_INPUT_PATH):
            return 0
        f = open(Beaglebone.TMP_SENSOR_ADC_INPUT_PATH, 'r')
        temp_c = self._tmp_sensor.get_temperature(int(f.read()))
        return temp_c

def main():
    bb  = Beaglebone()
    print bb.get_temperature()

if __name__ == "__main__":
    main()
