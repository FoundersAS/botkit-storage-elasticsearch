'use strict';

const es = require('elasticsearch');
const test = require('unit.js');

const client = new es.Client({
  host: process.env.ES_HOST || 'localhost:9200',
  log: 'error'
});
const testObj0 = {id: 'TEST0', foo: 'bar0'};
const testObj1 = {id: 'TEST1', foo: 'bar1'};
const manyObjs = [
  {id: 'TEST2', foo: 'bar2'},
  {id: 'TEST3', foo: 'bar3'}
];

const tearDown = function (index, cb) {
  client.indices.delete({
    index: `${index}*`,
    ignore: 404
  }, cb);
};

const testStorageMethod = function (storageMethod, index, cb) {
  storageMethod.save(testObj0, function (err, data) {
    test.assert(!err);
    storageMethod.save(testObj1, function (err) {
      test.assert(!err);
      storageMethod.get(testObj0.id, function (err, data) {
        test.assert(!err);
        test.assert(data.foo === testObj0.foo);
      });
      storageMethod.get('shouldnt-be-here', function (err, data) {
        test.assert(err.displayName === 'NotFound');
        test.assert(!data);
      });
      storageMethod.saveMany(manyObjs, function (err, data) {
        test.assert(!err);
        // Docs won't be available for search unless we refresh first
        client.indices.refresh({
          index: '*'
        }, function (err, data) {
          test.assert(!err);
          storageMethod.all(function (err, data) {
            test.assert(!err);
            const expected = [testObj0, testObj1].concat(manyObjs);
            test.assert(expected.length === data.length);
            tearDown(index, cb);
          });
        });
      });
    });
  });
};

const prefix = 'test-';
const meta = {
  index_users: `${prefix}slack-users`,
  type_users: `${prefix}slack-users`,
  index_channels: `${prefix}slack-channels`,
  type_channels: `${prefix}slack-channels`,
  index_teams: `${prefix}slack-teams`,
  type_teams: `${prefix}slack-teams`,
  version_postfix: '-v1'
};
const es_storage = require('../src/')({
  host: process.env.ES_HOST || 'localhost:9200',
  log: 'error'
}, meta, function (err, data) {
  if (err) throw err;
  testStorageMethod(es_storage.users, meta.index_users);
  testStorageMethod(es_storage.channels, meta.index_channels);
  testStorageMethod(es_storage.teams, meta.index_teams);
});
