(function () {
  const PASSWORD_HASH = 'deb114395272d4f2a20043c583fd028215f8bb598248ccb81ae33c4946f54556';

  document.documentElement.classList.add('privacy-locked');

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function unlock() {
    document.documentElement.classList.remove('privacy-locked');
    document.getElementById('privacyGate')?.remove();
  }

  function showGate() {
    const gate = document.createElement('div');
    gate.id = 'privacyGate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'privacyTitle');
    gate.innerHTML = `
      <div class="privacy-card">
        <h1 id="privacyTitle">Özel erişim</h1>
        <p>Bu sayfa herkese açık değildir. Devam etmek için erişim kodunu girin.</p>
        <form id="privacyForm">
          <label class="sr-only" for="privacyPassword">Erişim kodu</label>
          <input id="privacyPassword" type="password" autocomplete="off" placeholder="Erişim kodu" required autofocus>
          <button type="submit">Giriş Yap</button>
        </form>
        <div class="privacy-error" id="privacyError" aria-live="polite"></div>
        <p class="privacy-note">Her sayfa açılışında kod yeniden istenir.</p>
      </div>`;
    document.body.appendChild(gate);

    const form = gate.querySelector('#privacyForm');
    const input = gate.querySelector('#privacyPassword');
    const error = gate.querySelector('#privacyError');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const isValid = (await sha256(input.value.trim())) === PASSWORD_HASH;
      if (isValid) {
        unlock();
      } else {
        error.textContent = 'Erişim kodu hatalı.';
        input.value = '';
        input.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGate, { once: true });
  } else {
    showGate();
  }
})();
