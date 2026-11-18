const production={company:'https://nortivo.no',invest:'https://invest.nortivo.no',security:'https://korvnt.no'};
const localNames=new Set(['localhost','127.0.0.1','nortivo.localhost','invest.localhost','security.localhost','korvnt.localhost']);
export function siteOrigin(surface){
  const fallback=production[surface]||production.company;
  if(typeof location==='undefined'||!localNames.has(location.hostname)||typeof document==='undefined')return fallback;
  const configured=document.querySelector(`meta[name="nortivo-${surface}-origin"]`)?.content;
  try{const url=new URL(configured);if(url.protocol==='http:'&&localNames.has(url.hostname)&&!url.username&&!url.password)return url.origin;}catch{}
  return fallback;
}
