#/etc/rc.d/rc.local

echo "60" > /sys/class/gpio/export
echo "out" > /sys/class/gpio/gpio60/direction
python /root/home-control/python-scripts/thermo_monitor.py&
python /root/home-control/python-scripts/temperature_monitor.py&


# When the script is called in rc.local, network is not ready for unknown reasons.
# Solution found in this link:
# https://askubuntu.com/questions/672586/ssh-r-wont-run-in-etc-rc-local
# Tested with result of ~25s!!! for network to be ready 
(
until ping -nq -c3 10.0.0.138; do
   # Waiting for network
   sleep 5
done
node /root/home-control/app.js >/dev/null&
)&
