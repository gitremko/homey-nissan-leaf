'use strict';

const { Device } = require('homey');
const leafConnect = require('leaf-connect');

class LeafDevice extends Device {

  async onInit() {
    this.log('LeafDevice has been initialized');

    this.addCapability('measure_temperature_actual');

    const {
      username, password, pollInterval, regionCode,
    } = this.getSettings();

    this.updateCapabilities(username, password, regionCode);
    this.homey.setInterval(() => this.updateCapabilities(username, password, regionCode), pollInterval * 1000);

    this.registerCapabilityListener('button_climate', async (value) => {
      try {
        const client = await leafConnect({ username, password, regionCode });

        if (value) {
          await client.climateControlTurnOn();
          return value;
        }
        await client.climateControlTurnOff();
      } catch (error) {
        this.error(error);
      }
      return value;
    });

    this.registerCapabilityListener('button_charging', async (value) => {
      try {
        const client = await leafConnect({ username, password, regionCode });

        if (value) {
          await client.chargingStart();
          return value;
        }
      } catch (error) {
        this.error(error);
      }

      return value;
    });

    this.registerCapabilityListener('set_temperature', async (value) => {
      try {
        const client = await leafConnect({ username, password, regionCode });
        await client.setTargetTemperature(value);
        return value;
      } catch (error) {
        this.error(error);
      }
      return value;
    });
  }

  async updateCapabilities(username, password, regionCode) {
    try {
      const client = await leafConnect({ username, password, regionCode });

      const status = await client.cachedStatus();
      this.log('LeafDevice updateCapabilities cachedStatus:', status);

      const climateControlStatus = await client.climateControlStatus();
      this.log('LeafDevice updateCapabilities climateControlStatus:', climateControlStatus);

      const racr = climateControlStatus.RemoteACRecords;
      const acIsRunning = racr
        && racr.length > 0
        && racr.OperationResult
        && racr.OperationResult.toString().startsWith('START')
        && racr.RemoteACOperation === 'START';

      const {
        BatteryStatusRecords: {
          BatteryStatus, PluginState, CruisingRangeAcOn, CruisingRangeAcOff,
        },
      } = status;

      const isCharging = BatteryStatus && BatteryStatus.BatteryChargingStatus !== 'NOT_CHARGING';
      const isConnected = PluginState !== 'NOT_CONNECTED';

      this.setCapabilityValue('button_climate', acIsRunning).catch(this.error);
      this.setCapabilityValue('button_charging', isConnected && !isCharging).catch(this.error);
      this.setCapabilityValue('measure_battery', Number(BatteryStatus.SOC.Value)).catch(this.error);
      this.setCapabilityValue('is_charging', isCharging).catch(this.error);
      this.setCapabilityValue('is_connected', isConnected).catch(this.error);
      this.setCapabilityValue('set_temperature', Number(climateControlStatus.RemoteACRecords.PreAC_temp)).catch(this.error);
      this.log('Inc_temp (werkelijke temperatuur):', climateControlStatus.RemoteACRecords.Inc_temp);
      this.setCapabilityValue('measure_temperature_actual', Number(climateControlStatus.RemoteACRecords.Inc_temp)).catch(this.error);
      this.setCapabilityValue('cruising_range_ac_off', Number(CruisingRangeAcOff) / 1000).catch(this.error);
      this.setCapabilityValue('cruising_range_ac_on', Number(CruisingRangeAcOn) / 1000).catch(this.error);
    } catch (error) {
      this.error(error);
    }
  }

}

module.exports = LeafDevice;
