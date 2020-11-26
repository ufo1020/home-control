import pymongo
import datetime

class DBManager():
    COLLECTION_NAME = 'livingroom-temperature'
    CAPPED_COLLECTION_NAME = 'livingroom-temperature-capped'
    CAPPED_DAILY_COLLECTION_NAME = 'livingroom-temperature-daily-capped'
    COMMANDS_COLLECTION_NAME = 'commands-capped'

    def __init__(self, configuration_json):
        self.config = configuration_json
        self.client = None
        self.database = None
        self.collection = None
        self.capped_collection = None # for performance reason, cache last 10 records.
        self.capped_daily_collection = None  # for performance reason
        self.commands_collection = None

        self.connect()

    def connect(self):
        self.client = pymongo.MongoClient('mongodb://{}:{}@{}'.format(self.config['user'], self.config['password'], self.config['address']))
        self.database = self.client.home
        self.collection = self.database[DBManager.COLLECTION_NAME]
        self.capped_collection = self.database[DBManager.CAPPED_COLLECTION_NAME]
        self.capped_daily_collection = self.database[DBManager.CAPPED_DAILY_COLLECTION_NAME]
        self.commands_collection = self.database[DBManager.COMMANDS_COLLECTION_NAME]

    def insert_one(self, item):
        self.collection.insert_one(item)
        self.capped_collection.insert_one(item)
        self.capped_daily_collection.insert_one(item)

    def insert_command(self, item):
        self.commands_collection.insert_one(item)

    def get_last_command(self):
        cursor = self.commands_collection.find().skip(self.commands_collection.count() - 1)
        return [x for x in cursor][0]

    # def get_daily_records(self):
    #     cursor = self.capped_daily_collection.find()
    #     return [x for x in cursor]

    def get_daily_records(self, steps=1):
        from_timestamp = (datetime.datetime.now() - datetime.timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S')
        cursor = self.capped_daily_collection.find()
        records = [x for x in cursor]
        return [x for x in records if x['timestamp'] > from_timestamp][::steps]

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