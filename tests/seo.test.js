import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const robots=readFileSync(new URL('robots.txt',root),'utf8');
const sitemap=readFileSync(new URL('sitemap.xml',root),'utf8');
const cname=readFileSync(new URL('CNAME',root),'utf8');
const workflow=readFileSync(new URL('.github/workflows/pages.yml',root),'utf8');
const sw=readFileSync(new URL('sw.js',root),'utf8');
const domain='https://scandeck.luizbizzio.com/';
test('public domain and crawl metadata agree',()=>{
  assert.equal(cname.trim(),'scandeck.luizbizzio.com');
  assert.match(html,/rel="canonical" href="https:\/\/scandeck\.luizbizzio\.com\/"/);
  assert.match(html,/property="og:url" content="https:\/\/scandeck\.luizbizzio\.com\/"/);
  assert.match(robots,/Sitemap: https:\/\/scandeck\.luizbizzio\.com\/sitemap.xml/);
  assert.match(sitemap,/<loc>https:\/\/scandeck\.luizbizzio\.com\/<\/loc>/);
  assert.equal((sitemap.match(/<loc>/g)||[]).length,1);
  assert.match(workflow,/CNAME robots.txt sitemap.xml dist\//);
});
test('metadata and structured data describe actual site',()=>{
  assert.match(html,/<meta name="description" content="Play small browser games/);
  const json=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json);
  const data=JSON.parse(json);
  const app=data['@graph'].find(x=>x['@type']==='WebApplication');
  assert.equal(app.url,domain);
  assert.equal(app.isAccessibleForFree,true);
  assert.equal(app.name,'ScanDeck');
  assert.match(html,/<a class="tab" href="#library" data-tab="library">Games<\/a>/);
  assert.doesNotMatch(html,/noindex/);
});
test('camera helper is part of published offline site',()=>{
  assert.match(workflow,/cp src\/\*\.js src\/style\.css dist\/src\//);
  assert.match(sw,/src\/scanner-geometry\.js/);
  assert.match(html,/src\/app\.js\?v=46/);
});
