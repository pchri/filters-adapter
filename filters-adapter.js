/**
 * filters-adapter.js - Filters adapter.
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

class FiltersProperty extends Property {
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

/* abstract */ 
class FiltersDevice extends Device {
  constructor(adapter, id, conf) {
    super(adapter, id);
    this.name = conf['name'];
    this.type = 'filter';
    this.timer = null;
    this['@type'] = ['Light', 'OnOffSwitch'];
    this.properties.set('time', new FiltersProperty(this, 'time', {
      '@type': 'Number',
      label: 'Time',
      name: 'time',
      type: 'integer',
      unit: 'seconds',
      value: conf['time']
    }));
    this.properties.set('output', new FiltersProperty(this, 'output', {
      '@type': 'OnOffProperty',
      label: 'Output',
      name: 'output',
      type: 'boolean',
      value: false
    }));
    this.properties.set('input', new FiltersProperty(this, 'input', {
      '@type': 'OnOffProperty',
      label: 'Input',
      name: 'input',
      type: 'boolean',
      value: false
    }));
  }

  unload() {
    this.stopTimer();
  }

  /**
   * Start a timer with a duration from the time property.
   * Call timeoutHandler() when timer fires
   */
  startTimer() {
    this.stopTimer();
    const seconds = this.findProperty('time').value;
    var self = this;
    this.timer = setTimeout(() => { self.timeoutHandler(); }, seconds*1000);    
  }

  /**
   * Stop the timer if it is running.
   */
  stopTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Common behaviour the the timer fires.
   * Reset output
   */
  timeoutHandler() {
    this.setProperty('output', false);
    this.timer = null;
  }  
}

class CountdownTimerDevice extends FiltersDevice {
  constructor(adapter, id, conf) {
    super(adapter, id, conf);
    this.description = 'Countdown Timer';
  }

  /**
   * When a property changes see if the timer should be started or stopped
   * @param {FiltersProperty} property
   */
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if (property.name == 'input') {
      if (property.value) {
        this.stopTimer();
        this.setProperty('output', true);
      }
      else {
        this.startTimer();
      }
    }
  }
}

class LeadingEdgeDetectorDevice extends FiltersDevice {
  constructor(adapter, id, conf) {
    super(adapter, id, conf);
    this.description = 'Leading Edge Detector';    
  }

  /**
   * When a property changes see if the timer should be started or stopped
   * @param {FiltersProperty} property
   */
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if (property.name == 'input' && property.value) {
      if (this.timer == null) {
        this.startTimer();
      }
      this.setProperty('output', true);
    }
  }
}

class FlipFlopDevice extends FiltersDevice {
  constructor(adapter, id, conf) {
    super(adapter, id, conf);
    this.description = 'Flip-Flop';
    this.lastSeen = false;    
  }

  /**
   * When a property changes see if the timer should be started or stopped
   * @param {FiltersProperty} property
   */
  notifyPropertyChanged(property) {
    if (property.name == 'input') {
      if (property.value && !this.lastSeen) {
        this.setProperty('output', !this.findProperty('output').value);
      }
      this.lastSeen = property.value;
    }
    super.notifyPropertyChanged(property);
  }
}

class SquareWaveDevice extends FiltersDevice {
  constructor(adapter, id, conf) {
    super(adapter, id, conf);
    this.description = 'Square Wave Generator';    
  }

  /**
   * For SquareWaveDevice use setInterval for the timer.
   * Call timeoutHandler() when timer fires
   */
  startTimer() {
    this.stopTimer();
    const seconds = this.findProperty('time').value;
    var self = this
    this.timer = setInterval(() => { self.timeoutHandler(); }, seconds*1000);    
  }

  /**
   * When a property changes see if the timer should be started or stopped
   * @param {FiltersProperty} property
   */
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if (property.name == 'input') {
      if (property.value) {
        this.setProperty('output', true);
        this.startTimer();
      }
      else {
        this.setProperty('output', false);
        this.stopTimer();
      }
    }
  }

  /**
   * Special behaviour for SquareWaveDevice. 
   * Toggle Output.
   */
  timeoutHandler() {
    this.setProperty('output', !this.findProperty('output').value);
  }  
}

class FiltersAdapter extends Adapter {
  constructor(addonManager, packageName) {
    super(addonManager, 'FiltersAdapter', packageName);
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

  /**
   * The adapter is being unloaded.
   * Return a Promise that resolves when unloading is done
   */
  unload() {
    let devname;
    for (devname in this.getDevices()) {
      this.getDevice(devname).unload();
    }
    return super.unload();
  }

  addDeviceFromConfig(conf) {
    let device;
    const deviceId = 'filters-device-'+conf['name'];
    switch (conf['type']) {
      case 'countdown':
        device = new CountdownTimerDevice(this, deviceId, conf);
        break;
      case 'edge detector':
        device = new LeadingEdgeDetectorDevice(this, deviceId, conf);
        break;
      case 'flip-flop':
        device = new FlipFlopDevice(this, deviceId, conf);
        break;
      case 'square wave':
        device = new SquareWaveDevice(this, deviceId, conf);
        break;
      default:
        console.error('FiltersAdapter: what device? ', conf['type']);
        return new Promise();
    }
    return this.addDevice(deviceId, device);
  }

  /**
   * Add a new device to the adapter.
   *
   * The important part is to call: `this.handleDeviceAdded(device)`
   *
   * @param {String} deviceId ID of the device to add.
   * @param {device} device to add
   * @return {Promise} which resolves to the device added.
   */
  addDevice(deviceId, device) {
    return new Promise((resolve, reject) => {
      if (deviceId in this.devices) {
        reject(`Device: ${deviceId} already exists.`);
      } else {
        this.handleDeviceAdded(device);
        resolve(device);
      }
    });
  }

  /**
   * Example process to remove a device from the adapter.
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
      console.log('FiltersAdapter: device:', device.id, 'was unpaired.');
    }).catch((err) => {
      console.error('FiltersAdapter: unpairing', device.id, 'failed');
      console.error(err);
    });
  }
}

function loadFiltersAdapter(addonManager, manifest, _errorCallback) {
  const adapter = new FiltersAdapter(addonManager, manifest.name);
}

module.exports = loadFiltersAdapter;
