import {expect} from 'chai';
// import * as utils from 'src/utils.js';
import { config } from 'src/config.js';
import { BANNER, VIDEO } from 'src/mediaTypes.js';
import {spec} from 'modules/verizonMediaBidAdapter.js';

const AD_CONTENT = '<script>logInfo(\'ad\');</script>';
const DEFAULT_BID_ID = '84ab500420319d';
const DEFAULT_BID_POS = 'header';

let generateBidObject = ({bidId, pos}) => {
  return {
    adUnitCode: 'test-div',
    auctionId: 'b06c5141-fe8f-4cdf-9d7d-54415490a917',
    bidder: 'verizonmedia',
    bidId,
    bidderRequestId: '7101db09af0db2',
    mediaTypes: {
      banner: {
        sizes: [[300, 250], [300, 600]]
      }
    },
    sizes: [[300, 250], [300, 600]],
    params: {
      dcn: '2c9d2b50015c5ce9db6aeeed8b9500d6',
      pos
    }
  }
}

let getDefaultBidRequest = () => {
  return {
    bidderCode: 'verizonmedia',
    auctionId: 'd3e07445-ab06-44c8-a9dd-5ef9af06d2a6',
    bidderRequestId: '7101db09af0db2',
    start: new Date().getTime(),
    bids: [generateBidObject({bidId: DEFAULT_BID_ID, pos: DEFAULT_BID_POS})]
  };
};

let getDefaultBidderRequest = () => {
  return {
    auctionId: 'b06c5141-fe8f-4cdf-9d7d-54415490a917',
    auctionStart: new Date().getTime(),
    bidderCode: 'verizonmedia',
    bidderRequestId: '15246a574e859f',
    bids: getDefaultBidRequest().bids,
    gdprConsent: {
      consentString: 'BOtmiBKOtmiBKABABAENAFAAAAACeAAA',
      vendorData: {},
      gdprApplies: true
    },
    refererInfo: {
      canonicalUrl: undefined,
      numIframes: 0,
      reachedTop: true,
      referer: 'https://publisher-test.com'
    }
  }
};

let getValidBidResponse = () => {
  return {
    id: '245730051428950632',
    cur: 'USD',
    seatbid: [{
      bid: [{
        id: 1,
        impid: '245730051428950632',
        price: 0.09,
        adm: AD_CONTENT,
        crid: 'creative-id',
        h: 90,
        w: 728,
        dealid: 'deal-id',
        ext: {sizeid: 225}
      }]
    }]
  };
};

describe('Verizon Media Bid Adapter', () => {
  describe('isBidRequestValid()', () => {
    const INVALID_INPUT = [
      {},
      {params: {}},
      {params: {dcn: '2c9d2b50015a5aa95b70a9b0b5b10012'}},
      {params: {dcn: 1234, pos: 'header'}},
      {params: {dcn: '2c9d2b50015a5aa95b70a9b0b5b10012', pos: 1234}},
      {params: {dcn: '2c9d2b50015a5aa95b70a9b0b5b10012', pos: ''}},
      {params: {dcn: '', pos: 'header'}},
    ];

    INVALID_INPUT.forEach(input => {
      it(`should determine that the bid is invalid for the input ${JSON.stringify(input)}`, () => {
        expect(spec.isBidRequestValid(input)).to.be.false;
      });
    });

    it('should determine that the bid is valid if dcn and pos are present on the params object', () => {
      const validBid = {
        params: {
          dcn: '2c9d2b50015a5aa95b70a9b0b5b10012',
          pos: 'header'
        }
      };
      expect(spec.isBidRequestValid(validBid)).to.be.true;
    });
  });

  describe('buildRequests()', () => {
    describe('for display ads', () => {
      let validBidRequests;
      let bidderRequest;
      beforeEach(() => {
        validBidRequests = getDefaultBidRequest().bids;
        bidderRequest = getDefaultBidderRequest();
      });

      it('should not return request when no bids are present', function () {
        let [request] = spec.buildRequests([]);
        expect(request).to.be.undefined;
      });

      it('should not return request when bids are not for display ads', function () {
        validBidRequests[0].mediaTypes = {};
        validBidRequests[0].mediaTypes[VIDEO] = {
          playerSize: [640, 480],
          context: 'instream'
        };
        let [request] = spec.buildRequests(validBidRequests, bidderRequest);
        expect(request).to.be.undefined;
      });

      it('should return an array with the correct amount of request objects', () => {
        expect(spec.buildRequests(validBidRequests, bidderRequest)).to.be.an('array').to.have.lengthOf(1);
      });

      it('should return request objects that make a POST request to the default endpoint', () => {
        expect(spec.buildRequests(validBidRequests, bidderRequest)[0]).to.deep.include(
          {
            method: 'POST',
            url: 'https://c2shb.ssp.yahoo.com/bidRequest'
          });
      });

      it('should return request objects with the relevant custom headers and content type declaration', () => {
        expect(spec.buildRequests(validBidRequests, bidderRequest)[0].options).to.deep.equal(
          {
            contentType: 'application/json',
            customHeaders: {
              'x-openrtb-version': '2.3'
            },
            withCredentials: true
          });
      });

      it('should return request objects that do not send cookies if purpose 1 consent is not provided', () => {
        bidderRequest.gdprConsent = {
          consentString: 'BOtmiBKOtmiBKABABAENAFAAAAACeAAA',
          apiVersion: 2,
          vendorData: {
            purpose: {
              consents: {
                '1': false
              }
            }
          },
          gdprApplies: true
        };
        expect(spec.buildRequests(validBidRequests, bidderRequest)[0].options.withCredentials).to.be.false;
      });

      it('should return a valid openRTB object in the data field', () => {
        let bid = validBidRequests[0];
        expect(spec.buildRequests(validBidRequests, bidderRequest)[0].data).to.deep.equal({
          id: bidderRequest.auctionId,
          imp: [{
            id: bid.bidId,
            banner: {
              mimes: ['text/html', 'text/javascript', 'application/javascript', 'image/jpg'],
              format: [{w: 300, h: 250}, {w: 300, h: 600}],
              tagid: bid.params.pos
            },
            ext: {
              pos: bid.params.pos
            }
          }],
          site: {
            id: bidderRequest.bids[0].params.dcn,
            page: bidderRequest.refererInfo.referer
          },
          device: {
            ua: Navigator.userAgent
          },
          regs: {
            ext: {
              'us_privacy': '',
              gdpr: 1
            }
          },
          user: {
            regs: {
              gdpr: {
                euconsent: bidderRequest.gdprConsent.consentString
              }
            },
            ext: {
              eids: []
            }
          }
        });
      });

      describe('validating overrides', () => {
        it('should return request objects that make a POST request to the override endpoint', () => {
          const testOverrideEndpoint = 'http://foo.bar.baz.com/bidRequest';
          config.setConfig({
            verizonMedia: {
              endpoint: testOverrideEndpoint
            }
          });
          expect(spec.buildRequests(validBidRequests, bidderRequest)[0]).to.deep.include(
            {
              method: 'POST',
              url: testOverrideEndpoint
            });
        });

        it('should return a single request object for single request mode', () => {
          config.setConfig({
            verizonMedia: {
              singleRequestMode: true
            }
          });
          const secondBidId = '84ab50xxxxx';
          const secondBidPos = 'footer';
          validBidRequests.push(generateBidObject({bidId: secondBidId, pos: secondBidPos}));
          const output = spec.buildRequests(validBidRequests, bidderRequest);
          expect(output.data.imp).to.be.an('array').with.lengthOf(2);
          expect(output.data.imp[0]).to.deep.include({
            id: DEFAULT_BID_ID,
            ext: {pos: DEFAULT_BID_POS}
          });
          expect(output.data.imp[1]).to.deep.include({
            id: secondBidId,
            ext: {pos: secondBidPos}
          });
        });
      });
    });

    describe('validating user identity data', () => {

    });
  });

  describe('interpretResponse()', () => {

  });

  describe('getUserSyncs()', () => {

  });
});
