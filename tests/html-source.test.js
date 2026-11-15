import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineScriptRanges,firstHtmlAttribute} from '../tools/build/html-source.mjs';
import {compactGameHtml} from '../tools/build/optimize-encoding.mjs';

test('HTML parser ignores fake scripts in comments and reads case-insensitive tags',()=>{
 const html='<!-- <script>bad()</script> --!><SCRIPT TYPE="text/javascript"> const answer = 42; </ScRiPt >';
 const found=inlineScriptRanges(html);
 assert.equal(found.length,1);
 assert.equal(found[0].source,' const answer = 42; ');
 assert.equal(html.slice(found[0].start,found[0].end),found[0].source);
});

test('HTML parser recognizes browser-supported end tags with extra attributes',()=>{
 const html='<script> const answer = 42; </script data-probe="yes"><p>Remain</p>';
 const scripts=inlineScriptRanges(html);
 assert.equal(scripts.length,1);
 assert.equal(scripts[0].source,' const answer = 42; ');
});

test('Inline script offsets survive quoted attributes and similar markup',()=>{
 const html='<p data-x=">script">Hello</p><script data-id="1>2"> let n = 1 + 2; </script><script>n += 3;</script>';
 const scripts=inlineScriptRanges(html);
 assert.deepEqual(scripts.map(x=>x.source),[' let n = 1 + 2; ','n += 3;']);
 for(const block of scripts)assert.equal(html.slice(block.start,block.end),block.source);
});

test('External script tags do not become inline minification targets',()=>{
 const html='<script src="/game.js"></script><script>let value = 10 + 20;</script>';
 const scripts=inlineScriptRanges(html);
 assert.equal(scripts.length,1);
 assert.equal(scripts[0].source,'let value = 10 + 20;');
});

test('Attributes are read from parsed nodes, including encoded characters',()=>{
 const html='<!-- <button onclick="bad()"></button> --><button onclick="p.textContent=&quot;OK&quot;">Go</button>';
 assert.equal(firstHtmlAttribute(html,'button','onclick'),'p.textContent="OK"');
 assert.equal(firstHtmlAttribute(html,'button','href'),undefined);
});

test('Minification preserves all markup outside the parsed script ranges',async()=>{
 const html='<p data-x="1>0">Hello</p><script type="text/javascript"> const answer = 2 + 2; console.log(answer); </script><p>End</p>';
 const result=await compactGameHtml(html);
 assert.ok(result.startsWith('<p data-x="1>0">Hello</p><script type="text/javascript">'));
 assert.ok(result.endsWith('</script><p>End</p>'));
 assert.equal(inlineScriptRanges(result).length,1);
 assert.ok(inlineScriptRanges(result)[0].source.length < inlineScriptRanges(html)[0].source.length);
});

test('Script-like text inside comments remains unchanged during minification',async()=>{
 const html='<!-- <script> neverRun(); </script> --><script> const answer = 10 + 20; alert(answer); </script>';
 const result=await compactGameHtml(html);
 assert.ok(result.startsWith('<!-- <script> neverRun(); </script> -->'));
 assert.equal(inlineScriptRanges(result).length,1);
});
