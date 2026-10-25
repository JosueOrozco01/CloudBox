'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const life = require('../src/services/subscription-lifecycle.service');
test('change-plan validates input and accepts valid request', () => {
 const x = life.validatePayment({newPlanId:3,paymentMethodId:1,referenceCode:'TEST-NEW-20261025',simulateFailure:false}, 'change');
 assert.equal(x.planId,3); assert.equal(x.simulateFailure,false);
});
test('renewal does not require a planId',()=>{
 const x=life.validatePayment({paymentMethodId:1,referenceCode:'TEST-REN-20261025'},'renew');
 assert.equal(x.planId,undefined);
});
test('rejects non-boolean simulateFailure',()=>{
 assert.throws(()=>life.validatePayment({newPlanId:2,paymentMethodId:1,referenceCode:'TEST-NEW-20261025',simulateFailure:'yes'},'change'),/booleano/);
});
test('rejects invalid plan ID',()=>{
 assert.throws(()=>life.validatePayment({newPlanId:-1,paymentMethodId:1,referenceCode:'TEST-NEW-20261025'},'change'));
});
test('maps same-plan conflict to 409',()=>{
 const e=life.toDomainError({code:'P0001',message:'CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL'});
 assert.equal(e.status,409);
});
