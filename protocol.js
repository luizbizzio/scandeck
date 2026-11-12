/** ScanDeck wire formats. No code execution happens in this module. */
export const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:';
export const QR_LIMIT = 4296; // Version 40, level L, alphanumeric mode (theoretical maximum).
export const MAX_SOURCE_BYTES = 256_000;
export const LEGACY_SNAKE = 's=[27,26,25],f=45,I=180;T=()=>{h=d&1?s[0]&56|s[0]+d&7:s[0]+d&63;s.unshift(h);h==f?f=A(s):s.pop();s.indexOf(h,1)>0&&O();R(s,f)}';

export function base43Encode(data) {
  let out = String(data.length & 1);
  for (let i = 0; i < data.length; i += 2) {
    const v = (data[i] << 8) | (i + 1 < data.length ? data[i + 1] : 0);
    out += ALPHABET[v % 43] + ALPHABET[Math.floor(v / 43) % 43] + ALPHABET[Math.floor(v / 1849)];
  }
  return out;
}
export function base43Decode(value) {
  if (!/^[01]/.test(value)) throw new Error('Invalid package padding.');
  const odd = Number(value[0]);
  const input = value.slice(1);
  if (input.length % 3) throw new Error('Incomplete code data.');
  if (input.length > 60_000) throw new Error('Code data is too large.');
  const result = new Uint8Array(input.length / 3 * 2 - odd);
  for (let i = 0, j = 0; i < input.length; i += 3) {
    const a = ALPHABET.indexOf(input[i]), b = ALPHABET.indexOf(input[i + 1]), c = ALPHABET.indexOf(input[i + 2]);
    if (a < 0 || b < 0 || c < 0) throw new Error('Invalid code characters.');
    const n = a + 43 * b + 1849 * c;
    if (n > 65535) throw new Error('Invalid code data.');
    if (j < result.length) result[j++] = n >> 8;
    if (j < result.length) result[j++] = n & 255;
  }
  return result;
}
export async function inflateRaw(bytes) {
  if (!('DecompressionStream' in globalThis)) throw new Error('This browser does not support decompression. Update your browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) { await reader.cancel(); throw new Error('Game content exceeds the safety size limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(all);
}
export async function deflateRaw(text) {
  if (!('CompressionStream' in globalThis)) throw new Error('This browser does not support compression. Update your browser.');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('The source is too large.');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
}
export async function packHtml(html) {
  if (!/<(?:canvas|html|body|svg|div|script)\b/i.test(html)) throw new Error('Paste an HTML game, not plain text.');
  const packed = `SD1:${base43Encode(await deflateRaw(html))}`;
  if (packed.length > QR_LIMIT) throw new Error(`This game needs ${packed.length} QR characters. The maximum is ${QR_LIMIT}. Reduce the HTML.`);
  return packed;
}
export function packScript(script) {
  const source = script.trim();
  if (!source || /[^\x20-\x7e]/.test(source)) throw new Error('Code 128 supports printable ASCII. Put the script on a single line.');
  if (!source.includes('(') && !source.includes('=')) throw new Error('Enter a JavaScript microgame program.');
  if (/<\/script/i.test(source)) throw new Error('Do not put a closing script tag in the code.');
  return `SDS:${source}`;
}
export function packMicroQuiz(text) {
  const value=text.trim().startsWith('MQ:')?text.trim():'MQ:'+text.trim();
  if(!/^MQ:Q[0-9][+*-][0-9]=[0-9]{1,2}$/.test(value) || value.length>15)throw new Error('Micro QR needs a tiny Q arithmetic bytecode program, e.g. Q2+2=4.');
  return value;
}
export async function decodeGame(raw) {
  const trimmed = raw.trim();
  const value = trimmed.startsWith('SDJ:') || trimmed.startsWith('SDS:') ? trimmed : trimmed.replace(/\s+/g, '');
  if (!value) throw new Error('No game code was provided.');
  if(value.startsWith('MQ:')) {
    const code=packMicroQuiz(value);
    return {title:'Micro Math',type:'MQ / MICRO QR',kind:'bytecode',source:code.slice(3),payload:code,size:code.length};
  }
  if (value.startsWith('IP3:') || value.startsWith('SD1:')) {
    const legacy = value.startsWith('IP3:');
    const html = await inflateRaw(base43Decode(value.slice(4)));
    if (!/<(?:script|canvas|body|html|svg|div)\b/i.test(html)) throw new Error('The package does not look like a game.');
    const heading=html.match(/<h[1-3][^>]*>([^<]{1,60})<\/h[1-3]>/i);
    const title=legacy?'Ironpass Micro':heading?heading[1].trim():'Custom game';
    return { title, type: legacy ? 'IP3 / QR' : 'SD1 / 2D', kind: 'html', source: html, payload: value, size: new TextEncoder().encode(html).length };
  }
  if (value.startsWith('SDS:')) {
    const script = value.slice(4);
    if (!script || script.length > 16_000 || /[^\x20-\x7e]/.test(script) || /<\/script/i.test(script)) throw new Error('Invalid standalone game code.');
    return { title: 'Standalone Barcode Game', type: 'SDS / CODE 128', kind: 'standalone', source: script, payload: value, size: script.length };
  }
  if (value.startsWith('SDJ:')) {
    const script = value.slice(4);
    if (script.length > 16_000) throw new Error('The microgame program is too large.');
    if (/[^\x20-\x7e]/.test(script) || /<\/script/i.test(script)) throw new Error('Invalid microgame characters.');
    return { title: 'Custom Microgame', type: 'SDJ / CODE 128', kind: 'micro', source: script, payload: value, size: script.length };
  }
  // Original public experiment: exact source match. This is not a universal raw-JS executor.
  if (value === LEGACY_SNAKE) return { title: 'Snake', type: 'LEGACY / CODE 128', kind: 'snake', source: value, payload: value, size: value.length };
  throw new Error('This code does not contain a compatible ScanDeck game.');
}