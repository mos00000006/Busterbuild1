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
