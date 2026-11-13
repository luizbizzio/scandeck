import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDimensions,focusedCrop,scanPause} from '../src/scanner-geometry.js';
test('dense scanning keeps more camera pixels than auto without passing worker limits',()=>{
  const auto=captureDimensions(1920,1080,'auto');
  for(const mode of ['code128','pdf417','rmqr','codablockf','dotcode']){
    const size=captureDimensions(1920,1080,mode);
    assert.ok(size.width>auto.width,mode);
    assert.ok(size.width*size.height<=(mode==='code128'?2_800_000:mode==='pdf417'||mode==='rmqr'?2_400_000:1_900_000),mode);
  }
  assert.deepEqual(captureDimensions(0,1080,'auto'),{width:1,height:1});
});
test('capture respects 2MP limits even on large mobile photos',()=>{
  for(const mode of ['iris','chromaqr','auto','pdf417']){
    const {width,height}=captureDimensions(4096,3072,mode);
    assert.ok(width>0&&height>0&&width*height<=(mode==='pdf417'?2_400_000:2_000_000),mode);
  }
});
test('focused crops remain centered, bounded and large enough for a code',()=>{
  for(const mode of ['pdf417','rmqr','maxicode']){
    for(const [w,h] of [[1920,1080],[1080,1920]]){
      const c=focusedCrop(w,h,mode);
      assert.ok(c.left>=0&&c.top>=0&&c.left+c.width<=w&&c.top+c.height<=h,mode);
      assert.ok(c.outputWidth*c.outputHeight<=1_650_000,mode);
      assert.ok(c.outputWidth>0&&c.outputHeight>0,mode);
    }
  }
  assert.throws(()=>focusedCrop(0,720,'rmqr'));
});
test('experimental formats pause longer between frames',()=>{
  assert.ok(scanPause('iris')>scanPause('pdf417'));
  assert.ok(scanPause('dotcode')>scanPause('qr'));
});
