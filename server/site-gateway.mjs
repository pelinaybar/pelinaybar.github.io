import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {SUPABASE_URL,SUPABASE_KEY} from '../apps/is-takip/src/config.js';
const COOKIE='__Host-dk_portal';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.pdf':'application/pdf','.zip':'application/zip','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};
export function safeRoute(value){try{const v=decodeURIComponent(value);if(!v.startsWith('/')||v.startsWith('//')||v.includes('\\')||v.includes('\0')||v.split('/').some(x=>x==='..'||x==='.'||x.startsWith('.')))return null;return v;}catch{return null;}}
function cookies(req){return Object.fromEntries((req.headers.cookie??'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x.length===2));}
export async function checkAccess(token,fetcher=fetch){if(!token||token.length>8000||!/^[A-Za-z0-9_.-]+$/.test(token))return false;const headers={apikey:SUPABASE_KEY,Authorization:'Bearer '+token};try{const user=await fetcher(SUPABASE_URL+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});if(!user.ok)return false;const data=await user.json();if(!data.id||!data.email_confirmed_at)return false;const viewer=await fetcher(SUPABASE_URL+'/rest/v1/rpc/sks_state',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});if(!viewer.ok)return false;const state=await viewer.json();return state.viewer?.manager===true||Number.isInteger(state.viewer?.memberId);}catch{return false;}}
async function readJson(req){if(req.body&&typeof req.body==='object'){if(Buffer.byteLength(JSON.stringify(req.body))>10000)throw Error('Body too large');return req.body;}let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>10000)throw Error('Body too large');}return JSON.parse(body||'{}');}
export function createGateway({root=path.resolve('.private-site'),fetcher=fetch}={}){return async function(req,res){
res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
const send=(status,body,type='text/plain; charset=utf-8')=>{res.statusCode=status;res.setHeader('Content-Type',type);res.end(req.method==='HEAD'?'':body);};
const url=new URL(req.url,'https://'+req.headers.host),rewritten=url.searchParams.getAll('__private_path');if(rewritten.length>1)return send(400,'Geçersiz adres.');const route=safeRoute(rewritten.length?'/'+rewritten[0]:url.pathname);if(!route)return send(400,'Geçersiz adres.');
if(route==='/_portal/session'){
 if(!['POST','DELETE'].includes(req.method))return send(405,'Yöntem desteklenmiyor.');if(req.headers.origin!=='https://'+req.headers.host)return send(403,'İstek kaynağı doğrulanamadı.');
 if(req.method==='DELETE'){res.setHeader('Set-Cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return send(204,'');}
 let body;try{body=await readJson(req);}catch{return send(400,'Geçersiz istek.');}if(!await checkAccess(body.access_token,fetcher))return send(403,'Bu hesabın site erişimi yok.');
 // Token validity and the current allowlist are checked again for every protected request.
 res.setHeader('Set-Cookie',COOKIE+'='+body.access_token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600');return send(204,'');
}
if(!['GET','HEAD'].includes(req.method))return send(405,'Yöntem desteklenmiyor.');
const publicFiles={'/_portal/login':'portal/login.html','/_portal/login.js':'portal/login.js','/_portal/login.css':'portal/login.css'};
let relative=publicFiles[route];if(route==='/_portal/logout.js'){if(!await checkAccess(cookies(req)[COOKIE],fetcher))return send(401,'Giriş gerekiyor.');relative='portal/logout.js';}if(!relative){
 if(!await checkAccess(cookies(req)[COOKIE],fetcher)){if(req.method==='GET'&&(req.headers.accept??'').includes('text/html')){res.statusCode=303;res.setHeader('Location','/_portal/login?next='+encodeURIComponent(route));return res.end();}return send(401,'Giriş gerekiyor.');}
 relative=route.slice(1);if(!relative||relative.endsWith('/'))relative+='index.html';
 if(!mime[path.extname(relative).toLowerCase()])return send(404,'Bulunamadı.');
}
try{const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));if(!manifest.includes(relative))return send(404,'Bulunamadı.');const file=await readFile(path.join(root,relative));return send(200,file,mime[path.extname(relative).toLowerCase()]??'application/octet-stream');}catch{return send(404,'Bulunamadı.');}
};}
