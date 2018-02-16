import pymongo

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