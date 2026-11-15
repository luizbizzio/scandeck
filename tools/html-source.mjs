/* Build-time HTML inspection. parse5 follows browser HTML parsing rules.
 * This is not an HTML sanitizer: it only locates inline script source ranges
 * without rewriting surrounding markup, attributes, or event handlers.
 */
import {parseFragment} from 'parse5';

function htmlElements(source){
  const document=parseFragment(source,{sourceCodeLocationInfo:true});
  const elements=[],stack=[...(document.childNodes||[])];
  while(stack.length){
    const node=stack.pop();
    if(node.tagName)elements.push(node);
    if(node.childNodes)stack.push(...node.childNodes);
    // Do not descend into <template>: its script contents are inert.
  }
  return elements;
}

export function inlineScriptRanges(source){
  const found=[];
  for(const node of htmlElements(source)){
    if(node.tagName!=='script')continue;
    if(node.attrs?.some(attr=>attr.name==='src'))continue;
    const location=node.sourceCodeLocation;
    if(!location?.startTag||!location?.endTag)continue;
    const start=location.startTag.endOffset;
    const end=location.endTag.startOffset;
    if(!Number.isInteger(start)||!Number.isInteger(end)||end<start)continue;
    found.push({start,end,source:source.slice(start,end)});
  }
  return found.sort((a,b)=>a.start-b.start);
}

export function firstHtmlAttribute(source,tagName,attributeName){
  const tag=String(tagName).toLowerCase();
  const name=String(attributeName).toLowerCase();
  for(const node of htmlElements(source)){
    if(node.tagName!==tag)continue;
    const attribute=node.attrs?.find(attr=>attr.name===name);
    if(attribute)return attribute.value;
  }
  return undefined;
}
