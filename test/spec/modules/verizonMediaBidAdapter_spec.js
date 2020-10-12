import {expect} from 'chai';
// import * as utils from 'src/utils.js';
import {spec} from 'modules/verizonMediaBidAdapter.js';

const AD_CONTENT = '<script>logInfo(\'ad\');</script>';

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

describe.only('Verizon Media Bid Adapter', () => {

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
      it('should not return request when no bids are present', function () {
        let [request] = spec.buildRequests([]);
        expect(request).to.be.undefined;
      });
      const validBidRequests = [{}];
      it('should make a POST request to the correct endpoint', () => {
        expect(spec.buildRequests(validBidRequests)).to.be.an('object').that.deep.includes(
          {
            method: 'POST',
            url: 'https://c2shb.ssp.yahoo.com'
          });
      });
    });
  });

  describe('interpretResponse()', () => {

  });

  describe('getUserSyncs()', () => {

  });
});
