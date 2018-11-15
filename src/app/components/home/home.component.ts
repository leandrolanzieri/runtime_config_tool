import { Component, OnInit } from '@angular/core';
import { SerialPortService } from '../../providers/serialport.service';

import * as SerialPort from 'serialport';

class ConfigOption {
  name: string = '';
  description?: string = '';
  value?: string = '';
  modified?: boolean = false;
}

enum Command {
  TEST = 'test',
  OPTIONS = 'options',
  SET = 'set',
  GET = 'get',
  REBOOT = 'reboot'
}

class Action {
  command: Command;
  param?: string;
  callback?: (data, param?) => void;
  callbackParam?: any
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  ports: any = [];
  port: any;
  parser: any;
  portsCheckInterval: NodeJS.Timer;
  connected: boolean = false;
  configOptions: ConfigOption[] = [];
  bootloader: boolean = false;
  processingAction: boolean = false;
  actionsQueue: Action[] = [];
  selectedPort: string;

  constructor(private serialportService: SerialPortService) { }

  ngOnInit() {
    this.scanPorts();
    this.portsCheckInterval = setInterval(() => this.scanPorts(), 1000);
  }


  scanPorts() {
    this.serialportService.listDevices().then((ports) => {
      this.ports = [];
      ports.forEach(port => {
        if (port.manufacturer != undefined) {
          this.ports.push(port);
        }
      });
    });
  }

  connectDevice(comName: string) {
    if (!this.connected) {
      console.log('Trying to connect to ', comName);
      this.serialportService.connect(comName).then((data) => {
        this.parser = data['parser'];
        this.port = data['port'];

        this.connected = true;

        this.port.flush((err) => {
          this.parser._flush((err) => {
            this.parser.on('data', (data) => {
              this.deviceDataCallback(data)
            });
            this.testBootloader();
          });
        });

      }).catch((error) => {
        console.error('Could not connect to port!');
        this.connected = false;
      });
    }
  }

  testBootloader() {
    this.addAction({
      command: Command.TEST,
      callback: this.cmdTestCb
    });
  }

  cmdTestCb = (data) => {
    if (data == 'BOOTLOADER_MODE') {
      this.bootloader = true;
      this.getConfigOptions();
    }
  }

  getConfigOptions() {
    this.addAction({
      command: Command.OPTIONS,
      callback: this.cmdOptionsCb
    });
  }

  disconnectDevice() {
    this.port.close((err) => {
      if (err) {
        console.error(err);
      }
      this.connected = false;
      this.configOptions = [];
    });
  }

  cmdOptionsCb = (data) => {
    this.configOptions = [];
    data = data.slice(0, -1);
    let options = data.split(';');

    options.forEach((option, index) => {
      let config = option.split(':');
      this.configOptions.push({
        name: config[0],
        description: config[1]
      });
      this.addAction({
        command: Command.GET,
        param: config[0],
        callback: this.cmdGetCb,
        callbackParam: index
      });
    });
  }

  saveConfig(option:string, value: string) {
    this.addAction({
      command: Command.SET,
      param: option + ' ' + value,
      callback: this.cmdSetCb
    })
    this.getConfigOptions();
  }

  cmdSetCb = (data) => {
    console.log('Set', data);
  }

  cmdGetCb = (data, configIdx: number) => {
    console.log('Get', data, configIdx);
    this.configOptions[configIdx].value = data;
  }

  addAction(action: Action) {
    this.actionsQueue.push(action);

    if (!this.processingAction) {
      this.processingAction = true;
      this.sendToDevice(this.actionsQueue[0].command, this.actionsQueue[0].param);
    }
  }

  deviceDataCallback(data) {
    if (!this.actionsQueue.length) {
      console.log('Unexpected response!');
      return;
    }

    let callback = this.actionsQueue[0].callback;
    let callbackParam = this.actionsQueue[0].callbackParam;
    console.log('DATA', data);
    this.actionsQueue.shift();

    if (this.actionsQueue.length) {
      this.sendToDevice(this.actionsQueue[0].command, this.actionsQueue[0].param);
    } else {
      this.processingAction = false;
    }

    if (callback) {
      if (callbackParam != undefined) {
        callback(data, callbackParam);
      } else {
        callback(data);
      }
    }
  }

  sendToDevice(command: Command, param?: string) {
    console.log('Sending command ', command, param);
    this.port.write(command + ' ' + param + '\n', (err) => {
      if (err) {
        console.error('Could not send command', err);
      }
    });
  }
}
