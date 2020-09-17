/**
 * This module adds verizonMediaId to the User ID module
 * The {@link module:modules/userId} module is required
 * @module modules/verizonMediaIdSystem
 * @requires module:modules/userId
 */

import {ajax} from '../src/ajax.js';
import {submodule} from '../src/hook.js';
import * as utils from '../src/utils.js';

const MODULE_NAME = 'verizonMedia';
const VMUID_ENDPOINT = 'https://ups.analytics.yahoo.com/ups/58300/fed';

function isEUConsentRequired(consentData) {
  return !!(consentData && consentData.gdpr && consentData.gdpr.gdprApplies);
}

/** @type {Submodule} */
export const verizonMediaIdSubmodule = {
  /**
   * used to link submodule with config
   * @type {string}
   */
  name: MODULE_NAME,
  /**
   * decode the stored id value for passing to bid requests
   * @function
   * @returns {{vmuid: string} | undefined}
   */
  decode(value) {
    return (value && typeof value.vmuid === 'string') ? {vmuid: value.vmuid} : undefined;
  },
  /**
   * get the VerizonMedia Id
   * @function
   * @param {SubmoduleParams} [configParams]
   * @param {ConsentData} [consentData]
   * @returns {IdResponse|undefined}
   */
  getId(configParams, consentData) {
    if (!configParams || typeof configParams.he !== 'string') {
      utils.logError('The verizonMediaId submodule requires the \'he\' parameter to be defined.');
      return;
    }

    const data = {
      '1p': configParams['1p'] ? configParams['1p'] : '0',
      he: configParams.he,
      gdpr: isEUConsentRequired(consentData) ? '1' : '0',
      euconsent: isEUConsentRequired(consentData) ? consentData.gdpr.consentString : '',
      us_privacy: consentData.uspConsent
    };

    const resp = function (callback) {
      const callbacks = {
        success: response => {
          let responseObj;
          if (response) {
            try {
              responseObj = JSON.parse(response);
            } catch (error) {
              utils.logError(error);
            }
          }
          callback(responseObj);
        },
        error: error => {
          utils.logError(`${MODULE_NAME}: ID fetch encountered an error`, error);
          callback();
        }
      };
      ajax(configParams.endpoint || VMUID_ENDPOINT, callbacks, JSON.stringify(data), {method: 'POST', withCredentials: true});
    };
    return {callback: resp};
  }
};

submodule('userId', verizonMediaIdSubmodule);
