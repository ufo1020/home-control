Thermo control
==============

About
-----

Home thermo control software allows to control temperture and watch the last 24 hours historical temperture data from graph.
This is Web based service, depending on the host IP address, to open the service just go to http://x.x.x.x should open up the web page with all the features that includes:
- Watch current temperture.
- Set target temperture, add/remove timers, and add a repeatly timer.
- Watch last 24 hours temperture data.

Hardware Prerequisites
----------------------

It currently support both BeagleBone Black and Rasberry Pi Model B. Web service using port 5000 on BeagleBone Black and 80 on Rasberry Pi.
On Rasberry Pi external ADC chip MCP3002(http://ww1.microchip.com/downloads/en/DeviceDoc/21294E.pdf) has been used to connect to temperture sensor and send analog inputs through SPI bus.
Temperture sensor model is TMP36(http://www.analog.com/media/en/technical-documentation/data-sheets/TMP35_36_37.pdf).
A generic relay is used to toggle home thermo switch, and it's controlled through a GPIO pin output.

Rasberry Setup
==============
MCP3002 connects to Board as:
    VDD: 3.3v, CLK: GPIO11 , Dout: GPIO09, Din: GPIO10,  CS: GPIO08, CH1: Ground Vss : Ground.
MCP3002 connects to TMP36 as:
    CHO: TMP36 output
GPIO25(Pin 22) is used as digital output to toggle relay

Enable hardware SPI through:
```shell
raspi-config
```

Add start-up script into rc.local:
```shell
sudo vim /etc/rc.local
```
Add following(assuming it's where you have the code):
```shell
/home/pi/home-control/tools/init_thermo_service.sh
```
BeagleBone Black Setup
=====================
TMP36 connects to Board as:
    VDD: P9_3 3.3v, Output: P9_40 AIN1
GPIO_60(Pin P9_12) is used as digital output to toggle relay

BeagleBone Black Debian 8.7 setup instruction
=============================================
OS setup:
- Debian image "Debian 8.7 2017-03-19 4GB SD LXQT" from https://beagleboard.org/latest-images
- run sudo /opt/scripts/tools/update_kernel.sh
- Kernal version: Linux beaglebone 4.4.68-ti-r108

Device tree setup for ADC:
- Enable ADC from command line: sudo sh -c "echo 'BB-ADC' > /sys/devices/platform/bone_capemgr/slots"
- Enable ADC from /boot/uEnv.txt, add:
     -- cape_enable=bone_capemgr.enable_partno=BB-ADC
- Check /sys/devices/platform/bone_capemgr/slots, should have:
     -- '4: P-O-L-   0 Override Board Name,00A0,Override Manuf,BB-ADC'

GPIO access setup:
from http://www.embeddedhobbyist.com/2016/05/beaglebone-black-gpio-permissions/
- sudo groupadd gpio
- sudo usermod -aG gpio debian(default user)
- sudo vi /etc/udev/rules.d/99-gpio.rules
  -- SUBSYSTEM=="gpio*", PROGRAM="/bin/sh -c 'chown -R root:gpio /sys/class/gpio; chmod -R 770 /sys/class/gpio; chown -R root:gpio /sys/devices/platform/ocp/4????000.gpio/gpio/; chmod -R 770 /sys/devices/platform/ocp/4????000.gpio/gpio/'"

- sudo reboot

- to check it's working:
  - echo 49 > /sys/class/gpio/export
  - ls -al /sys/class/gpio/
    - drwxrwx---  2 root gpio    0 May 16 21:09 .
	  	drwxr-xr-x 55 root root    0 May 16 21:03 ..
		  -rwxrwx---  1 root gpio 4096 May 16 21:09 export
		  lrwxrwxrwx  1 root gpio    0 May 16 21:09 gpio49 -> ../../devices/platform/ocp/4804c000.gpio/gpio/gpio49
- Add calling for init_beaglebone.sh into /etc/rc.local
// bower install polymerelements/iron-image

BeagleBone Black Debian 9.2 setup instruction
=============================================
OS setup:
	- Debian image "Debian 9.2 2017-10-10 4GB SD IoT" from https://beagleboard.org/latest-images
	- Run Etcher flash to SD card
	- Hold S2 button, start OS from SD card
	- Change /boot/uEnv, enable flash to emmc
	- Restart, LEDs should flash in knight pattern for 5 mins
	- Load OS from emmc

ADC and GPIO:
	- NOTHING NEED TO DO!!! ADC and GPIO are all setup the way same to mannual setup in 8.7 above

Initialise scripts:
	- Copy tools/init_beaglebone.service into /etc/systemd/system (NOT symlink)
	- Enable load service on start-up: sudo systemctl enable init_beaglebone.service
	- Manually start the new service: sudo service init_beaglebone start
Bashrc:
	- ~/.bashrc is not working, to solve it:
		- create ~/.bash_profile
		- add the following in:
			if [ -f ~/.bashrc ]; then
	   			. ~/.bashrc;
			fi

Updates
===============================================
Enable Mongodb SSL - Fix [SSL: CERTIFICATE_VERIFY_FAILED] error:
    - update out-date root certificate by: sudo apt install ca-certificates
    - verify ca updates in folder: /etc/ssl/certs
