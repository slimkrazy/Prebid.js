import { registerBidder } from '../src/adapters/bidderFactory.js';
import * as utils from '../src/utils.js';
// import { config } from '../src/config.js';

const BIDDER_CODE = 'verizonMedia';

const BID_RESPONSE_TTL = 3600;
const DEFAULT_CURRENCY = 'USD';
/*
const SUPPORTED_USER_ID_SOURCES = [
  'verizonmedia.com',
  'liveramp.com'
];
const BIDDING_SOURCE = {
  name: 'pbjs',
  version: '$prebid.version$'
};
*/
const SSP_ENDPOINT = 'https://c2shb.ssp.yahoo.com';

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
  let itemsRegExp = /(img|iframe)[\s\S]*?src\s*=\s*("|')(.*?)\2/gi;
  let tagNameRegExp = /\w*(?=\s)/;
  let srcRegExp = /src=("|')(.*?)\1/;
  let pixelsItems = [];

  if (pixels) {
    let matchedItems = pixels.match(itemsRegExp);
    if (matchedItems) {
      matchedItems.forEach(item => {
        let tagName = item.match(tagNameRegExp)[0];
        let url = item.match(srcRegExp)[2];

        if (tagName && tagName) {
          pixelsItems.push({
            type: tagName === SYNC_TYPES.IMAGE.TAG ? SYNC_TYPES.IMAGE.TYPE : SYNC_TYPES.IFRAME.TYPE,
            url: url
          });
        }
      });
    }
  }
  return pixelsItems;
}

function generatePayload(bid, bidderRequest) {
  let openRTBObject = {
    id: bid.transactionId,
    imp: [{
      id: bid.bidId,
      banner: {
        mimes: ['text/html', 'text/javascript', 'application/javascript', 'image/jpg'],
        format: transformSizes(bid.sizes),
        tagid: bid.params.pos
      },
      ext: {
        pos: bid.params.pos
      }
    }],
    site: {
      id: bid.params.dcn,
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
      }
    }
    /* TODO: Add support for VMUID
    requestUser.ext.eids = [{
      source: 'verizonmedia.com',
      uids: [{
        id: user.ids.vmuid
      }]
    }];
    */
  };
  return openRTBObject;
}
/* Utility functions */

export const spec = {
  code: BIDDER_CODE,

  aliases: [],

  isBidRequestValid: function(bid) {
    const params = bid.params;
    return (typeof params === 'object' &&
        typeof params.dcn === 'string' && params.dcn.length > 0 &&
        typeof params.pos === 'string' && params.pos.length > 0);
  },

  buildRequests: function(validBidRequests, bidderRequest) {
    let requestOptions = {
      contentType: 'application/json',
      customHeaders: {
        'x-openrtb-version': '2.3'
      }
    };

    if (!hasPurpose1Consent(bidderRequest)) {
      requestOptions.withCredentials = false;
    }

    return validBidRequests.map(bid => {
      return {
        url: SSP_ENDPOINT,
        method: 'POST',
        data: generatePayload(bid, bidderRequest),
        options: requestOptions
      };
    });
  },

  interpretResponse: function(serverResponse, bidRequest) {
    let response = [];
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
