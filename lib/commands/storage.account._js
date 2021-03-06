/**
* Copyright (c) Microsoft.  All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var __ = require('underscore');
var util = require('util');

var utils = require('../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var storage = cli.category('storage');

  var storageAccount = storage.category('account')
    .description($('Commands to manage your Storage accounts'));

  var keys = storageAccount.category('keys')
    .description($('Commands to manage your Storage account keys'));

  storageAccount.listCommand = function (options, _) {
      var service = utils._createStorageClient(cli.category('account').getCurrentSubscription(options.subscription), log);

      var storageAccounts;
      var progress = cli.interaction.progress($('Getting storage accounts'));
      try {
        storageAccounts = service.storageAccounts.list(_).storageServices;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(storageAccounts, function (outputData) {
        if(outputData.length === 0) {
          log.info($('No storage accounts defined'));
        } else {
          log.table(outputData, function (row, item) {
            row.cell($('Name'), item.serviceName);
            row.cell($('Label'), item.label ? item.properties.label : '');
            row.cell($('Location'), item.properties.location ||
              (item.properties.affinityGroup || '') +
              (item.properties.geoPrimaryRegion ? ' (' + item.properties.geoPrimaryRegion + ')' : ''));
          });
        }
      });
    };

  storageAccount.showCommand = function (name, options, _) {
      var service = utils._createStorageClient(cli.category('account').getCurrentSubscription(options.subscription), log);

      var storageAccount;
      var progress = cli.interaction.progress($('Getting storage account'));

      try {
        storageAccount = service.storageAccounts.get(name, _);
      } finally {
        progress.end();
      }

      if (storageAccount) {
        cli.interaction.formatOutput(storageAccount, function(outputData) {
          log.data($('Name'), outputData.serviceName);
          log.data($('Url'), outputData.uri);

          cli.interaction.logEachData($('Account Properties'), outputData.properties);
          cli.interaction.logEachData($('Extended Properties'), outputData.extendedProperties);
          cli.interaction.logEachData($('Capabilities'), outputData.capabilities);
        });
      } else {
        log.info($('No storage account found'));
      }
    };

  storageAccount.createCommand = function (name, options, _) {
      var service = utils._createStorageClient(cli.category('account').getCurrentSubscription(options.subscription), log);
      var managementService = utils._createManagementClient(cli.category('account').getCurrentSubscription(options.subscription), log);

      var storageOptions = {
        serviceName: name,
        label: options.label ? options.label : name,
        geoReplicationEnabled: (options.geoReplication === true).toString()
      };

      if (__.isString(options.description)) {
        storageOptions.description = options.description;
      }

      if (options.affinityGroup) {
        storageOptions.affinityGroup = options.affinityGroup;
      } else {
        storageOptions.location = cli.interaction.chooseIfNotGiven($('Location: '), $('Getting locations'), options.location,
          function (cb) {
            managementService.locations.list(function (err, result) {
              if (err) { return cb(err); }

              cb(null, result.locations.map(function (location) { return location.name; }));
            });
          }, _);
      }

      var progress = cli.interaction.progress($('Creating storage account'));
      try {
        service.storageAccounts.create(storageOptions, _);
      } finally {
        progress.end();
      }
    };

  storageAccount.updateCommand = function (name, options, _) {
      var service = utils._createStorageClient(cli.category('account').getCurrentSubscription(options.subscription), log);

      var storageOptions = { };
      if (__.isString(options.description)) {
        storageOptions.description = options.description;
      }

      if (options.label) {
        storageOptions.label = options.label;
      }

      if (options.geoReplication !== undefined || options.disableGeoReplication !== undefined) {
        storageOptions.geoReplicationEnabled = (options.geoReplication === true).toString();
      }

      var progress = cli.interaction.progress($('Updating storage account'));
      try {
        service.storageAccounts.update(name, storageOptions, _);
      } finally {
        progress.end();
      }
    };

  storageAccount.deleteCommand = function (name, options, _) {
      var service = utils._createStorageClient(cli.category('account').getCurrentSubscription(options.subscription), log);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete storage account %s? [y/n] '), name), _)) {
        return;
      }

      var progress = cli.interaction.progress($('Deleting storage account'));
      try {
        service.storageAccounts.delete(name, _);
      } finally {
        progress.end();
      }
    };

  keys.listCommand = function (name, options, _) {
      var service = utils._createStorageClient(cli.category('account').getCurrentSubscription(options.subscription), log);

      var keys;
      var progress = cli.interaction.progress($('Getting storage account keys'));
      try {
        keys = service.storageAccounts.getKeys(name, _);
      } finally {
        progress.end();
      }

      if (keys) {
        cli.interaction.formatOutput(keys, function(outputData) {
          log.data($('Primary'), outputData.primaryKey);
          log.data($('Secondary'), outputData.secondaryKey);
        });
      } else {
        log.info($('No storage account keys found'));
      }
    };

  keys.renewCommand = function (name, options, _) {
      var service = utils._createStorageClient(cli.category('account').getCurrentSubscription(options.subscription), log);

      if (!options.primary && !options.secondary) {
        throw new Error($('Need to specify either --primary or --secondary'));
      } else if (options.primary && options.secondary) {
        throw new Error($('Only one of primary or secondary keys can be renewed at a time'));
      }

      var type = options.primary ? 'primary' : 'secondary';

      var progress = cli.interaction.progress($('Renewing storage account key'));
      try {
        keys = service.storageAccounts.regenerateKeys({ serviceName: name, keyType: type }, _);
      } finally {
        progress.end();
      }

      if (keys) {
        cli.interaction.formatOutput(keys, function(outputData) {
          log.data($('Primary'), outputData.primaryKey);
          log.data($('Secondary'), outputData.secondaryKey);
        });
      } else {
        log.info($('No storage account keys found'));
      }
    };

  storageAccount.command('list')
    .description($('List storage accounts'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(storageAccount.listCommand);

  storageAccount.command('show <name>')
    .description($('Show a storage account'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(storageAccount.showCommand);

  storageAccount.command('create <name>')
    .description($('Create a storage account'))
    .option('-e, --label <label>', $('the storage account label'))
    .option('-d, --description <description>', $('the storage account description'))
    .option('-l, --location <name>', $('the location'))
    .option('-a, --affinity-group <name>', $('the affinity group'))
    .option('--geoReplication', $('indicates if the geo replication is enabled'))
    .option('--disable-geoReplication', $('indicates if the geo replication is disabled'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(storageAccount.createCommand);

  storageAccount.command('set <name>')
    .description($('Update a storage account'))
    .option('-e, --label <label>', $('the storage account label'))
    .option('-d, --description <description>', $('the storage account description'))
    .option('--geoReplication', $('indicates if the geo replication is enabled'))
    .option('--disable-geoReplication', $('indicates if the geo replication is disabled'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(storageAccount.updateCommand);

  storageAccount.command('delete <name>')
    .description($('Delete a storage account'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(storageAccount.deleteCommand);

  keys.command('list <name>')
    .description($('List the keys for a storage account'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(keys.listCommand);

  keys.command('renew <name>')
    .description($('Renew a key for a storage account from your account'))
    .option('--primary', $('Update the primary key'))
    .option('--secondary', $('Update the secondary key'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(keys.renewCommand);
};