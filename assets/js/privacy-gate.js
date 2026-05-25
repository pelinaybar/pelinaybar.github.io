
(function(){
  const PASSWORD_HASH = 'deb114395272d4f2a20043c583fd028215f8bb598248ccb81ae33c4946f54556';
  const STORAGE_KEY = 'private_site_access_granted_v1';
  document.documentElement.classList.add('privacy-locked');
  async function sha256(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function unlock(){
    sessionStorage.setItem(STORAGE_KEY,'1');
    document.documentElement.classList.remove('privacy-locked');
    const gate=document.getElementById('privacyGate');
    if(gate) gate.remove();
  }
  function showGate(){
    if(sessionStorage.getItem(STORAGE_KEY)==='1') return unlock();
    const gate=document.createElement('div');
    gate.id='privacyGate';
    gate.innerHTML=`<div class="privacy-card"><h1>Özel erişim</h1><p>Bu sayfa arama motorlarına kapalıdır. Devam etmek için erişim kodunu girin.</p><input id="privacyPassword" type="password" autocomplete="current-password" placeholder="Erişim kodu" autofocus><button id="privacyButton">Giriş Yap</button><div class="privacy-error" id="privacyError"></div><p class="privacy-note">Kod doğrulanınca bu sekmede site açılır.</p></div>`;
    document.body.appendChild(gate);
    const input=gate.querySelector('#privacyPassword');
    const btn=gate.querySelector('#privacyButton');
    const err=gate.querySelector('#privacyError');
    async function submit(){
      const ok=(await sha256(input.value.trim()))===PASSWORD_HASH;
      if(ok) unlock(); else { err.textContent='Erişim kodu hatalı.'; input.value=''; input.focus(); }
    }
    btn.addEventListener('click',submit);
    input.addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',showGate); else showGate();
})();
