import argparse
import sys
import os

JS_PATH = "/public/js/controllers/home-server.js"

def main():
    argParser = argparse.ArgumentParser()
    argParser.add_argument('ip', help="IP address")
    argParser.add_argument('port', help="Port")

    args = argParser.parse_args()
    print args.ip
    print args.port

    root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    assert (os.path.exists(root_path+JS_PATH))
    with open(root_path+JS_PATH, 'r') as file:
        # read a list of lines into data
        data = file.readlines()

    for i in range(0, len(data)):
        if 'var host_address' in data[i]:
            print data[i]
            data[i] = 'var host_address = "{}:{}";\n'.format(args.ip, args.port)
            print data[i]

    with open(root_path+JS_PATH, 'w') as file:
        file.writelines(data)

if __name__ == "__main__":
    sys.exit(main())

