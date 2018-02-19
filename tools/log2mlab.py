import pymongo
import sys
import json
import re

DB_CONFIGURATION_PATH = "/home/debian/home-control/db_config.json"
LOG_PATH = "/home/debian/home-control/python-scripts/temperature.log"

class DBManager():
    COLLECTION_NAME = 'livingroom-temperature'
    def __init__(self, configuration_json):
        self.config = configuration_json
        self.client = None
        self.database = None
        self.collection = None

        self.connect()

    def connect(self):
        self.client = pymongo.MongoClient('mongodb://{}:{}@{}'.format(self.config['user'], self.config['password'], self.config['address']))
        self.database = self.client.home
        self.collection = self.database[DBManager.COLLECTION_NAME]

    def insert_one(self, item):
        self.collection.insert_one(item)

    def get_last_number_of_records(self, N):
        return self.collection.find().skip(self.collection.count() - N)

    def delete_all(self):
        self.collection.delete_many({})

    def insert_many(self, records):
        for record in records:
            self.insert_one(record)

    def print_all(self):
        for item in self.collection.find({}):
            print item

def connect_db():
    f = open(DB_CONFIGURATION_PATH, 'r')
    json_obj = json.load(f)
    return DBManager(json_obj)

def main():
    db = connect_db()
    log = open(LOG_PATH, 'r')
    input_regex = re.compile("^(?P<Timestamp>(.*?)),(?P<Temperature>\d\d.\d),(?P<Target>\w)")
    for item in log:
        re_match = input_regex.match(item)
        if re_match:
            details = dict()
            details.update(re_match.groupdict())
            db.insert_one({'timestamp': details['Timestamp'], 'temperature': float(details['Temperature']), 'target': int(details['Target'])})
            print {'timestamp': details['Timestamp'], 'temperature': float(details['Temperature']), 'target': int(details['Target'])}
if __name__ == "__main__":
    sys.exit(main())

