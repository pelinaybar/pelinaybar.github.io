import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_KEY} from '../apps/is-takip/src/config.js';
const client=createClient(SUPABASE_URL,SUPABASE_KEY);
const button=document.createElement('button');button.textContent='Siteden çıkış';button.type='button';button.setAttribute('aria-label','Tüm siteden güvenli çıkış');button.style.cssText='position:fixed;bottom:16px;right:16px;z-index:2147483647;border:1px solid #ffffff66;border-radius:999px;padding:10px 16px;background:#123a38;color:#fff;font:500 13px system-ui;cursor:pointer;box-shadow:0 3px 16px #0003';document.body.append(button);
async function exit(){button.disabled=true;try{const response=await fetch('/_portal/session',{method:'DELETE'});if(!response.ok)throw Error('Çıkış tamamlanamadı.');await client.auth.signOut({scope:'local'});location.replace('/_portal/login');}catch{button.disabled=false;button.textContent='Tekrar çıkış yap';}}
button.addEventListener('click',exit);
client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')fetch('/_portal/session',{method:'DELETE'}).then(()=>location.replace('/_portal/login'));});
