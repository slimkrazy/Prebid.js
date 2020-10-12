# Overview

Module Name: Verizon Media Bid Adapter

Module Type: Bidder Adapter

Maintainer: hb-fe-tech@oath.com

# Description

Module that connects to Verizon Media's supply-side system.

# Test Parameters
```javascript
    var adUnits = [
        {
            code: 'test-mobile-ad',
            sizes: [[300, 250]],
            bids: [
                {
                    bidder: 'verizonMedia',
                    params: {
                        dcn: '2c9d2b50015a5aa95b70a9b0b5b10012',
                        pos: 'header'
                    }
                }
            ]
        }
    ];
```
