with open('dashboard/index.html', 'r') as f:
    content = f.read()

target = """              <button id="trello-authorize-btn" onclick="authorizeTrello()\""""

replacement = """              <!-- API Key field -->
              <div class="w-full max-w-md space-y-2 mb-6 text-left">
                <label for="trello-api-key-input" class="block text-label-md text-on-surface-variant uppercase tracking-wider">
                  API Key do Trello <span class="text-status-offline">*</span>
                </label>
                <div class="flex gap-2">
                  <input id="trello-api-key-input" type="text"
                    placeholder="Cole aqui sua API Key (ex: a1b2c3d4...)"
                    class="flex-1 border border-outline-variant rounded-xl px-4 py-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary bg-surface-container-low transition"/>
                  <a href="https://trello.com/power-ups/admin" target="_blank" rel="noopener" title="Obter API Key"
                     class="flex items-center px-3 border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface-container-high transition">
                    <span class="material-symbols-outlined text-[18px]">open_in_new</span>
                  </a>
                </div>
              </div>

              <button id="trello-authorize-btn" onclick="authorizeTrello()\""""

with open('dashboard/index.html', 'w') as f:
    f.write(content.replace(target, replacement))

with open('dashboard/app.js', 'r') as f:
    app_content = f.read()

import re
old_auth = re.search(r'function authorizeTrello\(\) \{.*?window\.location\.href = authUrl;\n\}', app_content, re.DOTALL)
if old_auth:
    new_auth = """function authorizeTrello() {
  const input  = document.getElementById('trello-api-key-input');
  const apiKeyInput = (input?.value || '').trim();
  const apiKey = apiKeyInput || CONFIG.trelloApiKey;

  if (!apiKey || apiKey === 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO') {
    showToast('Insira a API Key do Trello antes de continuar.', 'warning');
    input?.focus();
    return;
  }

  // Salva a API key localmente para o fluxo interno
  localStorage.setItem(TRELLO_LS_KEY_APIKEY, apiKey);
  state.trelloApiKey = apiKey;

  // Constrói a URL de autorização Trello
  const returnUrl = encodeURIComponent(window.location.href.split('#')[0]);
  const authUrl = [
    'https://trello.com/1/authorize',
    `?key=${apiKey}`,
    `&name=Atendimoveis+Dashboard`,
    `&response_type=token`,
    `&scope=read,write`,
    `&expiration=never`,
    `&return_url=${returnUrl}`,
  ].join('');

  addLog('info', 'Redirecionando para autorização Trello...');
  window.location.href = authUrl;
}"""
    app_content = app_content.replace(old_auth.group(0), new_auth)
    with open('dashboard/app.js', 'w') as f:
        f.write(app_content)
print("Restored Trello API key input")
