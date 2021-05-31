#!/usr/bin/python

from MCP3002 import MCP3002
from TMP36 import TMP36
import platform

class RaspberryPi(object):
    """Raspberry Pi specific settings which includes SPI pins, GPIOs etc.
    SPI chip MCP3002 connects to Board as:
        VDD: 3.3v, CLK: GPIO11 , Dout: GPIO09, Din: GPIO10,  CS: GPIO08, CH1: Ground Vss : Ground.
    SPI chip MCP3002 connects to TMP36 as:
        CHO: TMP36 output
    GPIO22(Pin 15) is used as digital output"""
    SPI_DEVICE = 0 # connect to SPI0
    SPI_VDD_VOLTAGE = 3300 #mV, connect to Pin_01
    MCP3002_CHANNEL = 0 # Temperature sensor connect to channel 0
    GPIO_FILE_PATH  = "/sys/class/gpio/gpio22/value"

    def __init__(self):
        # make sure it's the right board
        assert ("raspberrypi" in platform.uname())
        self._spi_adc = MCP3002(spi_device = RaspberryPi.SPI_DEVICE, adc_channel = RaspberryPi.MCP3002_CHANNEL)
        self._tmp_sensor = TMP36(max_voltage = RaspberryPi.SPI_VDD_VOLTAGE, max_adc_value = MCP3002.MAX_ADC_OUTPUT_VALUE)

    def get_temperature(self):
        temp_c = self._tmp_sensor.get_temperature(self._spi_adc.get_value())
        return temp_c

    def get_output_pin(self):
        return RaspberryPi.GPIO_FILE_PATH

def main():
    pi  = RaspberryPi()
    print pi.get_temperature()

if __name__ == "__main__":
    main()
