#!/bin/bash

#until Debian 9.2, this is called from /etc/rc.d/rc.local
#removed since Debian 9.2
#echo "60" > /sys/class/gpio/export

echo "out" > /sys/class/gpio/gpio60/direction
python /home/debian/home-control/python-scripts/thermo_monitor.py&
python /home/debian/home-control/python-scripts/temperature_monitor.py&
node /home/debian/home-control/app.js >/dev/null

# removed since Debian 9.2, as this is called from a system service
# When the script is called in rc.local, network is not ready for unknown reasons.
# Solution found in this link:
# https://askubuntu.com/questions/672586/ssh-r-wont-run-in-etc-rc-local
# Tested with result of ~25s!!! for network to be ready 
# (
# until ping -nq -c3 192.168.1.1; do
   # Waiting for network
#    sleep 5
# done
#node /home/debian/home-control/app.js >/dev/null
# )&
