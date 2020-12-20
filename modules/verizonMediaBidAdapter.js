import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER } from '../src/mediaTypes.js';
import * as utils from '../src/utils.js';
import {config} from '../src/config.js';
// import { config } from '../src/config.js';

const BIDDER_CODE = 'verizonMedia';

const BID_RESPONSE_TTL = 3600;
const DEFAULT_CURRENCY = 'USD';
const SUPPORTED_USER_ID_SOURCES = [
  'verizonmedia.com',
  'liveramp.com'
];
/*
// TODO(request SSP team add support for passing this
const BIDDING_SOURCE = {
  name: 'pbjs',
  version: '$prebid.version$'
};
*/
const SSP_ENDPOINT = 'https://c2shb.ssp.yahoo.com/bidRequest';

/* Utility functions */
function hasPurpose1Consent(bidderRequest) {
  if (bidderRequest && bidderRequest.gdprConsent) {
    if (bidderRequest.gdprConsent.gdprApplies && bidderRequest.gdprConsent.apiVersion === 2) {
      return !!(utils.deepAccess(bidderRequest.gdprConsent, 'vendorData.purpose.consents.1') === true);
    }
  }
  return true;
}

function getSize(size) {
  return {
    w: parseInt(size[0]),
    h: parseInt(size[1])
  }
}

function transformSizes(sizes) {
  if (utils.isArray(sizes) && sizes.length === 2 && !utils.isArray(sizes[0])) {
    return [ getSize(sizes) ];
  }
  return sizes.map(getSize);
}

function extractUserSyncUrls(pixels) {
  return [];
}

function getSupportedEids(bid) {
  if (utils.isArray(bid.userIdAsEids)) {
    return bid.userIdAsEids.filter(eid => {
      return SUPPORTED_USER_ID_SOURCES.indexOf(eid.source) !== -1;
    });
  }
  return [];
}

function generateOpenRtbObject(bidderRequest) {
  if (bidderRequest) {
    return {
      id: bidderRequest.auctionId,
      imp: [],
      site: {
        id: bidderRequest.bids[0].params.dcn,
        page: bidderRequest.refererInfo.referer
      },
      device: {
        ua: Navigator.userAgent
      },
      regs: {
        ext: {
          'us_privacy': bidderRequest.uspConsent ? bidderRequest.uspConsent : '',
          gdpr: bidderRequest.gdprConsent && bidderRequest.gdprConsent.gdprApplies ? 1 : 0
        }
      },
      user: {
        regs: {
          gdpr: {
            euconsent: bidderRequest.gdprConsent && bidderRequest.gdprConsent.gdprApplies
              ? bidderRequest.gdprConsent.consentString : ''
          }
        },
        ext: {
          eids: getSupportedEids(bidderRequest.bids[0])
        }
      }
    };
  }
}

function appendImpObject(bid, openRtbObject) {
  if (openRtbObject && bid) {
    openRtbObject.imp.push({
      id: bid.bidId,
      banner: {
        mimes: ['text/html', 'text/javascript', 'application/javascript', 'image/jpg'],
        format: transformSizes(bid.sizes),
        tagid: bid.params.pos
      },
      ext: {
        pos: bid.params.pos
      }
    });
  }
}

function generateServerRequest({payload, requestOptions}) {
  return {
    url: config.getConfig('verizonmedia.endpoint') || SSP_ENDPOINT,
    method: 'POST',
    data: payload,
    options: requestOptions
  };
}
/* Utility functions */

export const spec = {
  code: BIDDER_CODE,
  aliases: [],
  supportedMediaTypes: [BANNER],

  isBidRequestValid: function(bid) {
    const params = bid.params;
    return (typeof params === 'object' &&
        typeof params.dcn === 'string' && params.dcn.length > 0 &&
        typeof params.pos === 'string' && params.pos.length > 0);
  },

  buildRequests: function(validBidRequests, bidderRequest) {
    const requestOptions = {
      contentType: 'application/json',
      customHeaders: {
        'x-openrtb-version': '2.5'
      }
    };

    requestOptions.withCredentials = hasPurpose1Consent(bidderRequest);
    const payload = generateOpenRtbObject(bidderRequest);
    const filteredBidRequests = validBidRequests.filter(bid => {
      return Object.keys(bid.mediaTypes).includes(BANNER);
    });

    if (config.getConfig('verizonmedia.singleRequestMode') === true) {
      filteredBidRequests.forEach(bid => {
        appendImpObject(bid, payload);
      });
      return generateServerRequest({payload, requestOptions});
    }

    return filteredBidRequests.map(bid => {
      appendImpObject(bid, payload);
      return generateServerRequest({payload, requestOptions});
    });
  },

  interpretResponse: function(serverResponse, bidRequest) {
    const response = [];
    if (!serverResponse.body) {
      return response;
    }

    let bid;

    try {
      bid = serverResponse.body.seatbid[0].bid[0];
    } catch (e) {
      return response;
    }

    let cpm = (bid.ext && bid.ext.encp) ? bid.ext.encp : bid.price;

    response.push({
      bidderCode: bidRequest.bidderCode,
      requestId: bidRequest.bidId,
      ad: bid.adm,
      cpm: cpm,
      width: bid.w,
      height: bid.h,
      creativeId: bid.crid || 0,
      currency: response.cur || DEFAULT_CURRENCY,
      dealId: bid.dealid ? bid.dealid : null,
      netRevenue: true,
      ttl: BID_RESPONSE_TTL
    });

    return response;
  },

  getUserSyncs: function(syncOptions, serverResponses, gdprConsent, uspConsent) {
    const bidResponse = !utils.isEmpty(serverResponses) && serverResponses[0].body;

    if (bidResponse && bidResponse.ext && bidResponse.ext.pixels) {
      return extractUserSyncUrls(bidResponse.ext.pixels);
    }

    return [];
  }
};

registerBidder(spec);
