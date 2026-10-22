import test from 'node:test';
import assert from 'node:assert/strict';
import {validHubPrices,applyHubPrices,hubMeasureCost,hubPriceSuffix,createHubPriceSync,refreshHubCart} from '../sales-app/hub-prices.js';
const payload=(price=25999,unit='M2')=>({brand:'busterbuild',prices:[{code:' A18079 ',price_cents:price,unit,is_tile:1,coverage_per_box:1.44,pieces_per_box:2}]});
test('saved Hub prices override matching sales products and removal restores catalogue defaults',()=>{
 const products=[{_code:'a18079',_price:100,_sqm:1,_tilesPerBox:1},{_code:'other',_price:42}];
 assert.ok(applyHubPrices(products,validHubPrices(payload())));assert.equal(products[0]._price,259.99);assert.equal(products[0]._sqm,1.44);assert.equal(products[1]._price,42);
 assert.equal(applyHubPrices(products,validHubPrices(payload())),false);
 applyHubPrices(products,validHubPrices(payload(27999)));assert.equal(products[0]._price,279.99);
 applyHubPrices(products,new Map());assert.equal(products[0]._price,100);assert.equal(products[0]._sqm,1);
});
test('per-box and per-m² prices keep their exact entered price and calculate in the right unit',()=>{
 const p={_code:'A18079',_price:0};applyHubPrices([p],validHubPrices(payload(25999,'BOX')));
 assert.equal(p._price,259.99);assert.equal(hubPriceSuffix(p),'/box');assert.equal(hubMeasureCost(p,12,9),2339.91);
 applyHubPrices([p],validHubPrices(payload()));assert.equal(hubMeasureCost(p,12,9),3119.88);
});
test('failed sync preserves last successful prices and reports an offline warning',async()=>{
 const products=[{_code:'A18079',_price:10}];let fail=false;let changes=0;let warning;
 const sync=createHubPriceSync({getProducts:()=>products,onChange:()=>changes++,onStatus:(_m,failed)=>warning=failed,fetcher:async()=>{if(fail)throw Error();return Response.json(payload());}});
 assert.equal(await sync.refresh(),true);assert.equal(products[0]._price,259.99);assert.equal(changes,1);assert.equal(warning,false);
 fail=true;assert.equal(await sync.refresh(),false);assert.equal(products[0]._price,259.99);assert.equal(warning,true);
});
test('invalid feed never applies prices or accepts another brand',()=>{
 assert.throws(()=>validHubPrices({...payload(),brand:'powerbuild'}));assert.throws(()=>validHubPrices(payload(-1)));assert.throws(()=>validHubPrices(payload(100,'BAD')));
});
test('active cart and Smart Measure totals update; saved quote objects are untouched',()=>{
 const products=[{_code:'A18079',_price:259.99,_hubUnit:'BOX',_sqm:1.44}];
 const cart=[{code:'A18079',price:200,qty:12,perSqm:true,smartMeasure:true,smartArea:12,smartBoxes:9,fixedTotal:2400}];
 const next=refreshHubCart(cart,products);assert.equal(next[0].price,259.99);assert.equal(next[0].qty,9);assert.equal(next[0].fixedTotal,2339.91);assert.equal(cart[0].price,200);
});

const token='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const comboPayload=(price=239999)=>({brand:'busterbuild',prices:[{kind:'combo',token,code:'COMBO-NEW',name:'Ivory combo',includes_text:'7 boxes\n5 adhesive',image_slot:'tile',price_cents:price,unit:'EA',is_tile:0}]});
test('published combo imports once, resolves printed QR, updates price and active cart',async()=>{
 const {findHubScanned,hubScanToken}=await import('../sales-app/hub-prices.js');
 const products=[{_code:'ordinary',_price:10}];const raw=`https://maliks-group-hub.moyanamoses006.workers.dev/p/${token}?brand=busterbuild`;
 applyHubPrices(products,validHubPrices(comboPayload()));assert.equal(products.length,2);
 const combo=findHubScanned(products,raw);assert.equal(combo._name,'Ivory combo');assert.equal(combo._price,2399.99);assert.equal(combo._type,'combo');assert.equal(combo._description,'7 boxes\n5 adhesive');assert.equal(combo._image,`https://maliks-group-hub.moyanamoses006.workers.dev/api/public-price-tags/${token}/image?slot=tile`);
 assert.equal(applyHubPrices(products,validHubPrices(comboPayload())),false);assert.equal(products.length,2);
 applyHubPrices(products,validHubPrices(comboPayload(249999)));assert.equal(combo._price,2499.99);
 assert.equal(refreshHubCart([{code:'COMBO-NEW',qty:2,price:1}],products)[0].price,2499.99);
 assert.equal(hubScanToken(`https://evil.example/p/${token}`),'');
 applyHubPrices(products,new Map());assert.equal(products.length,1);assert.equal(findHubScanned(products,raw),undefined);
});
test('ordinary Hub tag QR resolves to matching existing product',async()=>{
 const {findHubScanned}=await import('../sales-app/hub-prices.js');const data=payload();data.prices[0].token=token;
 const products=[{_code:'A18079',_price:10}];applyHubPrices(products,validHubPrices(data));
 assert.equal(findHubScanned(products,`https://maliks-group-hub.moyanamoses006.workers.dev/p/${token}`),products[0]);
});
