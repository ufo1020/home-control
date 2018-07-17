#!/usr/bin/python

import spidev
import time

class MCP3002(object):
    """MCP3002 ADC chip SPI driver.
    The chip has 10 bit resolution, 2 channels, voltage range from 2.7v to 5v.
    Maximum speed rates 1.2Mhz at 2.7v and 3.7Mhz at 5.5v, however low down to 100kHz to increase accuracy.
    """
    MAX_SPEED_HZ = 100000
    MAX_ADC_OUTPUT_VALUE = 1 << 10
    BITS_PER_WORD = 8
    SPI_MODE = 0 # CPOL=0, CPHA=0
    SPI_PORT = 0 # raspberry pi spi port is alway 0, device is 0 ,1
    SPI_DEVICES = [0, 1]

    ADC_CHANNELS = [0 ,1] # MCP3002 has 2 channels

    # Send out 16 bits with following format:
    # channel = 0 sends 0110 1000 0000 0000
    # channel = 1 sends 0111 1000 0000 0000
    # sgl/diff = 1; odd/sign = channel; MSBF = 1
    START_BIT = 1
    SGL_DIFF_BIT = 1
    MSBF_BIT = 1

    START_BIT_OFFSET = 6
    SGL_DIFF_BIT_OFFSET = 5
    ODD_SIGN_BIT_OFFSET = 4
    MSBF_BIT_OFFSET = 3

    def __init__(self, spi_device, adc_channel):
        assert (spi_device in MCP3002.SPI_DEVICES)
        assert (adc_channel in  MCP3002.ADC_CHANNELS)
        self._device = spi_device
        self._channel = adc_channel
        # this depends on which spi device is connected to /dev/spidev0.0 or /dev/spidev0.1
        self._spi = spidev.SpiDev()
        self._spi.open(MCP3002.SPI_PORT, spi_device)
        self._spi.max_speed_hz = MCP3002.MAX_SPEED_HZ
        self._spi.bits_per_word = MCP3002.BITS_PER_WORD
        self._spi.mode = MCP3002.SPI_MODE

    def __del__(self):
        self._spi.close()

    def get_value(self):
        # spi transaction, returns the same bytes as send.
        ret = self._spi.xfer2([MCP3002.START_BIT << MCP3002.START_BIT_OFFSET | MCP3002.SGL_DIFF_BIT << MCP3002.SGL_DIFF_BIT_OFFSET
                                       | self._channel << MCP3002.ODD_SIGN_BIT_OFFSET | MCP3002.MSBF_BIT << MCP3002.MSBF_BIT_OFFSET, 0])
        # return 2 bytes, such as:
        # 00000 0       1  1  1  1  1  1  1  1  1  1
        #       NullBit B9 B8 B7 B6 B5 B4 B3 B2 B1 B0
        # ret[0]..............ret[1].................
        assert (len(ret) == 2)
        # ret[0] last 2 bits are B9 and B8, ret[1] are B7 - B0
        return ret[1] | (ret[0] & 3) << 8

def main():
    adc = MCP3002(spi_device = 0, adc_channel = 0)
    while True:
        value = adc.get_value()
        print value, (value/1024.0) * 3300
        time.sleep(1)

if __name__ == "__main__":
    main()
