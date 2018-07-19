#!/bin/bash

PROJECT_ROOT="$(dirname $PWD)"
IS_RASPBERRY_PI=$(uname -a | grep -q 'raspberry')
# raspberry pi setup
if [ $IS_RASPBERRY_PI ]; then
  #this is called from /etc/rc.d/rc.local
  echo "22" > /sys/class/gpio/export
  echo "out" > /sys/class/gpio/gpio22/direction
  python $PROJECT_ROOT/python-scripts/thermo_monitor.py&
  python $PROJECT_ROOT/python-scripts/temperature_monitor.py&
  # node $PROJECT_ROOT/app.js >/dev/null&
else
  #until Debian 9.2, this is called from /etc/rc.d/rc.local
  #removed since Debian 9.2
  #echo "60" > /sys/class/gpio/export
  echo "out" > /sys/class/gpio/gpio60/direction
  python $PROJECT_ROOT/python-scripts/thermo_monitor.py&
  python $PROJECT_ROOT/python-scripts/temperature_monitor.py&
  # node $PROJECT_ROOT/app.js >/dev/null
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
  #node /home/pi/home-control/app.js >/dev/null
  # )&
fi

(
until ping -nq -c3 8.8.8.8; do
   # Waiting for network
  sleep 5
done
# get primary ip address
IP_ADDRESS=$(ip addr | grep 'state UP' -A2 | tail -n1 | awk '{print $2}' | cut -f1  -d'/')
# get port
if $IS_RASPBERRY_PI; then
  PORT=80
  IP=$IP_ADDRESS PORT=$PORT node $PROJECT_ROOT/app.js >/dev/null&
else
  PORT=5000
  IP=$IP_ADDRESS PORT=$PORT node $PROJECT_ROOT/app.js >/dev/null
fi
)&
