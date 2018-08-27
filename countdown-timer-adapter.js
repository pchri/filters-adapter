/**
 * countdown-timer-adapter.js - Countdown Timer adapter.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const {
  Adapter,
  Database,
  Device,
  Property,
} = require('gateway-addon');

class CountdownTimerProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
  }

  /**
   * Set the value of the property.
   *
   * @param {*} value The new value to set
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    let changed = this.value !== value;
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        resolve(updatedValue);
        if (changed) {
          this.device.notifyPropertyChanged(this);
        }
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

class CountdownTimerDevice extends Device {
  constructor(adapter, id, deviceDescription) {
    super(adapter, id);
    this.name = deviceDescription.name;
    this.type = deviceDescription.type;
    this.timer = null;
    this['@type'] = deviceDescription['@type'];
    this.description = deviceDescription.description;
    for (const propertyName in deviceDescription.properties) {
      const propertyDescription = deviceDescription.properties[propertyName];
      const property = new CountdownTimerProperty(this, propertyName,
                                           propertyDescription);
      this.properties.set(propertyName, property);
    }
  }

  /**
   * When a property changes see if the timer should be started or stopped
   * @param {CountdownTimerProperty} property
   */
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if (property.name == 'input') {
      if (property.value) {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        this.setProperty('output', true);
      }
      else {
        var that = this
        const seconds = this.findProperty('time').value;
        this.timer = setTimeout(() => { that.timeoutHandler(); }, seconds*1000);
      }
    }
  }

  /**
   * The countdown timer has fired. Reset output
   */
  timeoutHandler() {
    this.setProperty('output', false);
    this.timer = null;
  }
}

class CountdownTimerAdapter extends Adapter {
  constructor(addonManager, packageName) {
    super(addonManager, 'CountdownTimerAdapter', packageName);
    addonManager.addAdapter(this);
    let promise;
    if (Database) {
      const db = new Database(packageName);
      promise = db.open().then( () => {
        return db.loadConfig();
      }).then( (config) => { 
        return Promise.all(config["devices"].map(this.addDeviceFromConfig, this));
      }).then();
    }
  }

  addDeviceFromConfig(conf) {
    // console.log("Promissing to add ", conf);
    return this.addDevice('countdown-timer-device-'+conf['name'].replace(/\s+|%/g, '-'), {
      name: conf['name'],
      '@type': ['Light', 'OnOffSwitch'],
      type: 'filter',
      description: 'Countdown Timer Device',
      properties: {
        time: {
          '@type': 'Number',
          label: 'Time',
          name: 'time',
          type: 'integer',
          unit: 'seconds',
          value: conf['time']
        },
        output: {
          '@type': 'OnOffProperty',
          label: 'Output',
          name: 'output',
          type: 'boolean',
          value: false
        },
        input: {
          '@type': 'OnOffProperty',
          label: 'Input',
          name: 'input',
          type: 'boolean',
          value: false
        }
      }
    });
  }

  /**
   * Example process to add a new device to the adapter.
   *
   * The important part is to call: `this.handleDeviceAdded(device)`
   *
   * @param {String} deviceId ID of the device to add.
   * @param {String} deviceDescription Description of the device to add.
   * @return {Promise} which resolves to the device added.
   */
  addDevice(deviceId, deviceDescription) {
    return new Promise((resolve, reject) => {
      if (deviceId in this.devices) {
        reject(`Device: ${deviceId} already exists.`);
      } else {
        const device = new CountdownTimerDevice(this, deviceId, deviceDescription);
        this.handleDeviceAdded(device);
        resolve(device);
      }
    });
  }

  /**
   * Example process ro remove a device from the adapter.
   *
   * The important part is to call: `this.handleDeviceRemoved(device)`
   *
   * @param {String} deviceId ID of the device to remove.
   * @return {Promise} which resolves to the device removed.
   */
  removeDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const device = this.devices[deviceId];
      if (device) {
        this.handleDeviceRemoved(device);
        resolve(device);
      } else {
        reject(`Device: ${deviceId} not found.`);
      }
    });
  }

  /**
   * Unpair the provided the device from the adapter.
   *
   * @param {Object} device Device to unpair with
   */
  removeThing(device) {
    this.removeDevice(device.id).then(() => {
      console.log('CountdownTimerAdapter: device:', device.id, 'was unpaired.');
    }).catch((err) => {
      console.error('CountdownTimerAdapter: unpairing', device.id, 'failed');
      console.error(err);
    });
  }
}

function loadCountdownTimerAdapter(addonManager, manifest, _errorCallback) {
  const adapter = new CountdownTimerAdapter(addonManager, manifest.name);
}

module.exports = loadCountdownTimerAdapter;
