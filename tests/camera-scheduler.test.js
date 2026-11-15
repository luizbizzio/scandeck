import test from 'node:test';
import assert from 'node:assert/strict';
import {autoQuickFormats,createAutoScanScheduler} from '../src/camera-scheduler.js';

test('Auto quick scans cover every regular symbology and keep QR on every pass',()=>{
 const quick=Array.from({length:5},(_,i)=>autoQuickFormats(i));
 assert.ok(quick.every(list=>list.includes('QRCode')));
 const formats=new Set(quick.flat());
 for(const type of ['QRCode','DataMatrix','Aztec','Code128','EAN13','MicroQRCode','MicroPDF417','DataBarExpStk'])
   assert.ok(formats.has(type),'Auto quick coverage missing '+type);
 assert.deepEqual(autoQuickFormats(5),quick[0]);
 assert.deepEqual(autoQuickFormats(-1),quick[4]);
});

test('Auto gives at least four regular scans between specialized work',()=>{
 const scanner=createAutoScanScheduler(0);
 const tasks=[];
 let now=0;
 for(let i=0;i<250;i++){
   const kind=scanner.next(now);
   tasks.push({kind,time:now});
   const duration=kind==='standard'?115:kind==='pdf417'?570:kind==='chroma'?1200:1500;
   now+=duration+240;
   scanner.report(kind,now,duration);
 }
 const quick=tasks.filter(t=>t.kind==='standard').length;
 assert.ok(quick>=tasks.length*.72,'Auto must prioritize common codes');
 for(const kind of ['pdf417','dotcode','chroma','iris'])
   assert.ok(tasks.some(t=>t.kind===kind),'Auto must eventually try '+kind);
 for(let i=0;i<tasks.length;i++){
   if(tasks[i].kind==='standard')continue;
   assert.ok(i>=4,'Auto started specialized scans too soon');
   assert.ok(tasks.slice(i-4,i).every(t=>t.kind==='standard'),
     'Auto ran specialized scans without four quick reads');
 }
});

test('Slow ChromaQR and IRIS results delay their next optional Auto pass',()=>{
 const scanner=createAutoScanScheduler(0);
 for(let i=0;i<4;i++)assert.equal(scanner.next(i*100),'standard');
 assert.equal(scanner.next(9100),'chroma');
 scanner.report('chroma',12500,3400);
 let chroma=0,iris=0;
 for(let i=0;i<100;i++){
   const now=12550+i*235;
   const task=scanner.next(now);
   if(task==='chroma')chroma++;
   if(task==='iris'){
     iris++;
     scanner.report('iris',now+2800,2800);
   }
 }
 assert.equal(chroma,0,'Slow ChromaQR must receive a cooldown');
 assert.ok(iris>=1,'IRIS must still get a scheduled opportunity');
});

test('Fresh camera sessions reset the format schedule',()=>{
 const first=createAutoScanScheduler(500);
 const second=createAutoScanScheduler(500);
 for(let i=0;i<5;i++)assert.equal(first.next(i*300+500),second.next(i*300+500));
});


test('DotCode is scheduled in Auto without monopolizing the camera',()=>{
 const scanner=createAutoScanScheduler(0);
 const tasks=[];
 let now=0;
 for(let i=0;i<360;i++){
  const kind=scanner.next(now),duration=kind==='standard'?120:kind==='dotcode'?750:kind==='pdf417'?430:1050;
  tasks.push({kind,time:now});now+=duration+240;scanner.report(kind,now,duration);
 }
 const dot=tasks.filter(x=>x.kind==='dotcode');
 assert.ok(dot.length>=2,'DotCode must be attempted periodically in Auto');
 assert.ok(dot.length<tasks.length*.08,'DotCode must stay infrequent to protect frame rate');
 for(const task of dot){
  const index=tasks.indexOf(task);
  assert.ok(index>=4&&tasks.slice(index-4,index).every(x=>x.kind==='standard'),
   'DotCode must follow at least four common-code reads');
 }
});

test('Slow DotCode decoding receives a longer Auto cooldown',()=>{
 const scanner=createAutoScanScheduler(0);
 const seen=[];
 let now=0,first=null;
 for(let i=0;i<180;i++){
  const kind=scanner.next(now);
  if(kind==='dotcode'){
   if(first!==null){assert.ok(now-first>=30000,'DotCode ran before cooldown');return}
   first=now;scanner.report(kind,now+3500,3500);now+=3500;
  }else now+=kind==='standard'?420:1200;
  seen.push(kind);
 }
 assert.fail('Auto never resumed DotCode after cooldown');
});
