'use strict';

const elasticsearch = require('elasticsearch');
const highland = require('highland');
const through = require('through2');
const async = require('async');

module.exports = function (options, meta, onInit) {
  if (meta === undefined) {
    meta = {};
  }

  const that = {};

  const _INDEX_USERS = meta.index_users || 'slack-users';
  const _TYPE_USERS = meta.type_users || 'slack-user';
  const _INDEX_CHANNELS = meta.index_channels || 'slack-channels';
  const _TYPE_CHANNELS = meta.type_channels || 'slack-channel';
  const _INDEX_TEAMS = meta.index_teams || 'slack-teams';
  const _TYPE_TEAMS = meta.type_teams || 'slack-team';
  const _VERSION_POSTFIX = meta.version_postfix || '';

  const client = new elasticsearch.Client(options);

  const init = function () {
    const indices = [_INDEX_TEAMS, _INDEX_USERS, _INDEX_CHANNELS];

    async.each(indices, createIndex, function (err) {
      if (err) throw err;
      client.cluster.health({
        waitForStatus: 'yellow'
      }, onInit);
    });

    function createIndex (index, cb) {
      index = `${index}${_VERSION_POSTFIX}`;
      client.indices.exists({ index }, function (err, res) {
        if (err) return cb(err);
        if (res) return cb();

        client.indices.create({ index }, function (err, res) {
          if (err) return cb(err);
          console.log(`Created index: ${index}`);
          if (_VERSION_POSTFIX) {
            client.indices.putAlias({
              index: index,
              name: index.replace(_VERSION_POSTFIX, '')
            }, cb);
          } else return cb();
        });
      });
    }
  };

  init();

  const get = function (index, type) {
    return function (id, cb) {
      client.get({
        index: index,
        type: type,
        id: id
      }, function (error, result) {
        cb(error, result._source || null);
      });
    };
  };

  const save = function (index, type) {
    return function (data, cb) {
      client.update({
        index: index,
        type: type,
        doc_as_upsert: true,
        id: data.id,
        body: { doc: data }
      }, cb);
    };
  };

  const saveMany = function (index, type) {
    return function (data, callback) {
      const dataStream = highland(data)
        .on('end', () => callback(null, index))
        .on('error', (err) => callback(err));

      let bulkData = [];

      dataStream.pipe(through.obj({highWaterMark: 0}, function (data, enc, cb) {
        bulkData.push(data);
        if (bulkData.length < 10 && data.length > 10) {
          return cb();
        }

        const body = bulkData.reduce(function (prev, curr) {
          const newAction = { update: { _id: curr.id } };
          const item = { doc: curr, doc_as_upsert: true };
          if (!prev) return [newAction, item];

          prev.push(newAction, item);
          return prev;
        }, null);

        client.bulk({
          index: index,
          type: type,
          body: body
        }, function (error, results) {
          bulkData = [];
          if (error) return cb(error);
          cb();
        });
      }));
    };
  };

  const all = function (index, type) {
    return function (cb) {
      let all = [];

      const onsearch = function (err, res) {
        if (err) cb(err, []);

        res.hits.hits.forEach(hit => all.push(hit._source));

        if (res.hits.total !== all.length) {
          client.scroll({
            scrollId: res._scroll_id,
            scroll: '30s'
          }, onsearch);
        } else return cb(err, all);
      };

      client.search({
        index: index,
        type: type,
        scroll: '30s',
        search_type: 'scan',
        body: { query: { match_all: { } } }
      }, onsearch);
    };
  };

  that.users = {
    get: get(_INDEX_USERS, _TYPE_USERS),
    save: save(_INDEX_USERS, _TYPE_USERS),
    saveMany: saveMany(_INDEX_USERS, _TYPE_USERS),
    all: all(_INDEX_USERS, _TYPE_USERS)
  };

  that.channels = {
    get: get(_INDEX_CHANNELS, _TYPE_CHANNELS),
    save: save(_INDEX_CHANNELS, _TYPE_CHANNELS),
    saveMany: saveMany(_INDEX_CHANNELS, _TYPE_CHANNELS),
    all: all(_INDEX_CHANNELS, _TYPE_CHANNELS)
  };

  that.teams = {
    get: get(_INDEX_TEAMS, _TYPE_TEAMS),
    save: save(_INDEX_TEAMS, _TYPE_TEAMS),
    saveMany: saveMany(_INDEX_TEAMS, _TYPE_TEAMS),
    all: all(_INDEX_TEAMS, _TYPE_TEAMS)
  };

  return that;
};
