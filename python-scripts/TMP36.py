#!/usr/bin/python

class TMP36(object):
    """TMP36 tmperature sensor driver"""
    OUTPUT_VOLTAGE_AT_ZERO_C_mV = 500
    OUTPUT_VOLTAGE_PER_C_mV = 10 # 10mV/C  

    def __init__(self, max_voltage, max_adc_value):
        self._max_voltage = max_voltage 
        self._max_adc_value = max_adc_value 

    def get_temperature(self, adc_value):
        millivolts = (float(adc_value)/float(self._max_adc_value)) * self._max_voltage 
        temp_c = (millivolts - TMP36.OUTPUT_VOLTAGE_AT_ZERO_C_mV) / TMP36.OUTPUT_VOLTAGE_PER_C_mV
        return "%.1f" % temp_c

if __name__ == "__main__":
    pass
