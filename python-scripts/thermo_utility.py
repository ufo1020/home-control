import os.path
import zmq
import time
import json
import datetime
import gevent
from db_manager import DBManager

# path is relative to project root path
TEMPERATURE_LOG_FILE_PATH = "python-scripts/temperature.log"
DB_CONFIGURATION_PATH = "db_config.json"
ERROR_LOG_PATH = "python-scripts/error.log"

LOCAL_PORT = "9001"
LOCAL_ADDRESS = "tcp://127.0.0.1" + ":" + LOCAL_PORT

TEMPERATURE_RECORDS_FROM_LOG = False
TEMPERATURE_RECORDS_FROM_DB = True

TIMTOUT = 10 #seconds

def send(message, recv = False, timeout=TIMTOUT):
    context = zmq.Context()
    sock = context.socket(zmq.REQ)
    sock.connect(LOCAL_ADDRESS)
    sock.send(message)
    if recv:
        response = None
        with gevent.Timeout(timeout):
            response = sock.recv()
        return response

def send_get_target():
    return send("--getTarget", recv=True)

def send_get_current():
    return send("--getCurrent", recv=True)

def get_project_root_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

def connect_db():
    f = open(os.path.join(get_project_root_path(), DB_CONFIGURATION_PATH), 'r')
    json_obj = json.load(f)
    return DBManager(json_obj)

def get_next_datetime(timer):
    """Get the repeated timer next day.
    Arguments:
    timer -- datetime.time type
    Return datetime.time
    """
    now = datetime.datetime.now()
    # always looking for future time, for example, now is 22:00, next is 07:00
    # now > next
    if now.time() > timer:
        tmw = datetime.date.today() + datetime.timedelta(days=1)
        timer = datetime.datetime(tmw.year, tmw.month, tmw.day, timer.hour, timer.minute)
    else:
        timer = datetime.datetime(now.year, now.month, now.day, timer.hour, timer.minute)
    return timer

def write_to_error_log(line):
    f = open(os.path.join(get_project_root_path() ,ERROR_LOG_PATH), "a")
    f.write(line)
    f.close()

def update_data_with_savgol_filter(data, window_size, order):
    y = [float(x['temperature']) for x in data]
    smoothed_data = savgol_filter(y, window_size, order)
    for counter, item in enumerate(data):
        item['temperature'] = str(smoothed_data[counter])
    return data

def savgol_filter(y, window_size, order, deriv=0, rate=1):
    r"""
    https://scipy-cookbook.readthedocs.io/items/SavitzkyGolay.html
    
    Smooth (and optionally differentiate) data with a Savitzky-Golay filter.
    The Savitzky-Golay filter removes high frequency noise from data.
    It has the advantage of preserving the original shape and
    features of the signal better than other types of filtering
    approaches, such as moving averages techniques.
    Parameters
    ----------
    y : array_like, shape (N,)
        the values of the time history of the signal.
    window_size : int
        the length of the window. Must be an odd integer number.
    order : int
        the order of the polynomial used in the filtering.
        Must be less then `window_size` - 1.
    deriv: int
        the order of the derivative to compute (default = 0 means only smoothing)
    Returns
    -------
    ys : ndarray, shape (N)
        the smoothed signal (or it's n-th derivative).
    Notes
    -----
    The Savitzky-Golay is a type of low-pass filter, particularly
    suited for smoothing noisy data. The main idea behind this
    approach is to make for each point a least-square fit with a
    polynomial of high order over a odd-sized window centered at
    the point.
    Examples
    --------
    t = np.linspace(-4, 4, 500)
    y = np.exp( -t**2 ) + np.random.normal(0, 0.05, t.shape)
    ysg = savitzky_golay(y, window_size=31, order=4)
    import matplotlib.pyplot as plt
    plt.plot(t, y, label='Noisy signal')
    plt.plot(t, np.exp(-t**2), 'k', lw=1.5, label='Original signal')
    plt.plot(t, ysg, 'r', label='Filtered signal')
    plt.legend()
    plt.show()
    References
    ----------
    .. [1] A. Savitzky, M. J. E. Golay, Smoothing and Differentiation of
       Data by Simplified Least Squares Procedures. Analytical
       Chemistry, 1964, 36 (8), pp 1627-1639.
    .. [2] Numerical Recipes 3rd Edition: The Art of Scientific Computing
       W.H. Press, S.A. Teukolsky, W.T. Vetterling, B.P. Flannery
       Cambridge University Press ISBN-13: 9780521880688
    """
    import numpy as np
    from math import factorial
    try:
        window_size = np.abs(np.int(window_size))
        order = np.abs(np.int(order))
    except ValueError:
        raise ValueError("window_size and order have to be of type int")
    if window_size % 2 != 1 or window_size < 1:
        raise TypeError("window_size size must be a positive odd number")
    if window_size < order + 2:
        raise TypeError("window_size is too small for the polynomials order")
    order_range = range(order+1)
    half_window = (window_size -1) // 2
    # precompute coefficients
    b = np.mat([[k**i for i in order_range] for k in range(-half_window, half_window+1)])
    m = np.linalg.pinv(b).A[deriv] * rate**deriv * factorial(deriv)
    # pad the signal at the extremes with
    # values taken from the signal itself
    firstvals = y[0] - np.abs(np.array(y[1:half_window+1][::-1]) - y[0] )
    lastvals = y[-1] + np.abs(np.array(y[-half_window-1:-1][::-1]) - y[-1])
    y = np.concatenate((firstvals, y, lastvals))
    return np.convolve( m[::-1], y, mode='valid')
