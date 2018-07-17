#!/usr/bin/python

from RaspberryPi import RaspberryPi
from Beaglebone import Beaglebone
import platform
import os
import threading
import time

class Board(threading.Thread):
    """Singleton board class, wrapper class to talk to the real board """
    SLEEP_DURATION = 10

    __instance = None

    @staticmethod
    def getInstance():
        """ Static access method. """
        if Board.__instance == None:
            Board()
        return Board.__instance

    def __init__(self):
        """ Singleton constructor """
        if Board.__instance != None:
            raise Exception("This class is a singleton, calls Board.getInstance() instead")
        else:
            Board.__instance = self

        threading.Thread.__init__(self)
        # Only support RaspberryPi and BeagleBone
        assert ("raspberrypi" in platform.uname() or "beaglebone" in platform.uname())
        if "raspberrypi" in platform.uname():
            self._platform = RaspberryPi()
        else:
            self._platform = Beaglebone()

        # cached filtered temperature
        self._cached_temperature = 0.0
        # force to get a cached temperature once
        self.get_filtered_temperature()
        # start thread by itself only once
        self.start()

    def run(self):
        while True:
            self.get_filtered_temperature()
            time.sleep(Board.SLEEP_DURATION)

    def get_filtered_temperature(self):
        num_of_samples = 10
        samples = []
        for i in range(num_of_samples):
            t = float(self._platform.get_temperature())
            samples.append(t)
            time.sleep(0.2)
        samples.sort()
        # remove min/max and average
        # print samples
        samples.pop(0)
        samples.pop()
        temp_c = sum(samples) / float(len(samples))
        self._cached_temperature = "%.1f" % temp_c
        # print self._cached_temperature
        return "%.1f" % temp_c

    def get_catched_temperature(self):
        return self._cached_temperature

    def get_switch_state(self):
        if not os.path.exists(self._platform.get_output_pin()):
            return False
        f = open(self._platform.get_output_pin(), 'r')
        value = f.read()
        f.close()
        if len(value) != 1:
            return False
        if value == "1":
            return True
        else:
            return False

    def set_switch(self, value):
        if int(value) not in [0, 1]:
            return
        if not os.path.exists(self._platform.get_output_pin()):
            return
        f = open(self._platform.get_output_pin(), 'w')
        f.write(value)
        f.close()

def main():
    board  = Board()
    print board.get_filtered_temperature()

if __name__ == "__main__":
    main()
