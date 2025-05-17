'use strict';

const { Driver } = require('homey');
const leafConnect = require('leaf-connect');

class LeafDriver extends Driver {

  async onInit() {
    this.log('LeafDriver has been initialized');
  }

  async onPair(session) {
    let username;
    let password;
    let client;
    let regionCode;
    let pollInterval;

    session.setHandler('validate', async (data) => {
      if (!data.username) throw Error('Enter username');
      if (!data.password) throw Error('Enter password');
      if (!data.regionCode) throw Error('Select region code');
      if (!data.pollInterval) throw Error('Enter poll interval');

      username = data.username;
      password = data.password;
      regionCode = data.regionCode;
      pollInterval = Number(data.pollInterval);

      client = await leafConnect({
        username,
        password,
        regionCode,
      });

      const session = client.sessionInfo();

      return session.status === 200;
    });

    session.setHandler('list_devices', async () => {
      try {
        const session = client.sessionInfo();

        // For some odd reason VehicleInfoList is not present on 1th gen Leafs
        // It is only there for 2nd gen Leafs
        const vehicles = session.vehicleInfo || session.VehicleInfoList.vehicleInfo;

        const capabilities = [
          'measure_battery',
          'button_climate',
          'button_charging',
          'is_charging',
          'is_connected',
          'cruising_range_ac_off',
          'cruising_range_ac_on',
          'set_temperature',
        ];

        const settings = {
          username,
          password,
          pollInterval,
          regionCode,
        };

        const devices = vehicles.map((vehicle) => ({
          name: vehicle.nickname,
          data: {
            id: vehicle.vin,
          },
          capabilities,
          settings,
        }));
        this.log('LeafDriver list_devices:', devices);

        return devices;
      } catch (error) {
        this.error(error);
        return [];
      }
    });
  }

}

module.exports = LeafDriver;
