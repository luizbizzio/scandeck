import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDimensions,focusedCrop,scanPause,exoticCaptureRegion} from '../src/scanner-geometry.js';
test('dense scanning keeps more camera pixels than auto without passing worker limits',()=>{
  const auto=captureDimensions(1920,1080,'auto');
  for(const mode of ['code128','pdf417','micropdf417','rmqr','codablockf','dotcode']){
    const size=captureDimensions(1920,1080,mode);
    assert.ok(size.width>auto.width,mode);
    assert.ok(size.width*size.height<=(mode==='code128'?2_800_000:mode==='pdf417'||mode==='micropdf417'||mode==='rmqr'?2_400_000:2_000_000),mode);
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
  for(const mode of ['pdf417','micropdf417','rmqr','maxicode']){
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

test('rMQR alternates horizontal and vertical crop bands for rotated phone views',()=>{
  const horizontal=focusedCrop(1920,1080,'rmqr',1);
  const vertical=focusedCrop(1920,1080,'rmqr',2);
  assert.ok(horizontal.width>vertical.width);
  assert.ok(horizontal.height<vertical.height);
  assert.ok(horizontal.outputWidth*horizontal.outputHeight<=1_650_000);
  assert.ok(vertical.outputWidth*vertical.outputHeight<=1_650_000);
  const maxiA=focusedCrop(1920,1080,'maxicode',1);
  const maxiB=focusedCrop(1920,1080,'maxicode',3);
  assert.ok(maxiB.width<maxiA.width,'Dedicated MaxiCode pass should zoom into centered codes');
});

test('experimental camera scans preserve full sensor detail and use unscaled center crops',()=>{
  const size=captureDimensions(1920,1080,'codablockf');
  assert.ok(size.width*size.height>1_900_000,'Keep almost 2 MP of fine module detail');
  assert.ok(size.width*size.height<=2_000_000,'Never exceed the worker bound');
  const full=exoticCaptureRegion(size.width,size.height,0);
  assert.deepEqual(full,{left:0,top:0,width:size.width,height:size.height});
  for(const frame of [1,2]){
    const crop=exoticCaptureRegion(size.width,size.height,frame);
    assert.ok(crop.left>0&&crop.top>0);
    assert.ok(crop.width<size.width&&crop.height<size.height);
    assert.ok(crop.left+crop.width<=size.width&&crop.top+crop.height<=size.height);
  }
  assert.ok(exoticCaptureRegion(1920,1080,2).width<exoticCaptureRegion(1920,1080,1).width);
  assert.throws(()=>exoticCaptureRegion(0,1080,2));
});

test('Auto capture stays bounded for sustained camera performance',()=>{
  const size=captureDimensions(4032,3024,'auto');
  assert.ok(size.width*size.height<=750_000);
  const dedicated=captureDimensions(4032,3024,'rmqr');
  assert.ok(dedicated.width*dedicated.height>size.width*size.height);
  const r0=focusedCrop(1920,1080,'rmqr',0),r1=focusedCrop(1920,1080,'rmqr',1);
  assert.ok(r0.width>0&&r0.height>0&&r1.width>0&&r1.height>0);
});

test('live camera processing has bounded pixel budgets for color and stacked formats',()=>{
 for(const mode of ['auto','iris','chromaqr','pdf417','micropdf417','dotcode']){
  const frame=captureDimensions(4032,3024,mode);
  const limit=['iris','chromaqr'].includes(mode)?700_000:mode==='auto'?500_000:mode==='dotcode'?1_100_000:1_600_000;
  assert.ok(frame.width*frame.height<=limit,'Excessive '+mode+' worker frame');
 }
 assert.ok(scanPause('auto')<scanPause('iris'));
});
