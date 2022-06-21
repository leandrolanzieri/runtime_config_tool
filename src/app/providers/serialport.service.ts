import { Injectable } from '@angular/core';

import * as serialport from 'serialport';

const Readline = window.require('@serialport/parser-readline');

@Injectable()
export class SerialPortService {

    serialport: typeof serialport;
    readline: any;

    constructor() {
        this.serialport = window.require('serialport');

    }

    listDevices = () => {
        return this.serialport.list();
    }

    connect(comName: string) {
        return new Promise((resolve, reject) => {
            let port = window.require('serialport')(comName, (err) => {
                console.error('Service: Could not open', err);
                reject(err);
            });
            let parser = port.pipe(new Readline({ delimiter: '\n' }));
            port.on('open', (data) => {
              resolve({parser: parser, port: port});
            });
        });
    }
} 