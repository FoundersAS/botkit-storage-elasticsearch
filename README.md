# botkit-storage-elasticsearch

A Elasticsearch storage module for Botkit

## Installation

    npm install botkit-elasticsearch-storage

## Usage

    const esStorage = require('botkit-elasticsearch-storage')({
      host: process.env.ES_HOST,
      log: 'info'
    }, {
      index_users: 'slack-users',
      type_users: 'slack-users',
      index_channels: 'slack-channels',
      type_channels: 'slack-channels',
      index_teams: 'slack-teams',
      type_teams: 'slack-teams',
      version_postfix: '-v1'
    }, oninitstorage);

    const controller = Botkit.slackbot({
      debug: false,
      storage: esStorage
    });

    function oninitstorage () {
      // We're now sure that indices has been created so we can start the bot.
    }

### Options

The first object passed to `botkit-storage-elasticsearch` are for elasticsearch's
client. https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/quick-start.html

The second object is the object that defines the names/aliases of the indices,
the client will create.

The second object can contain the following keys (see usage example):
    
    index_users
    type_users
    index_channels
    type_channels
    index_teams
    type_teams
    version_postfix
