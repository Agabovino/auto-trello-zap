import re

# ----------------- REVERT INDEX.HTML -----------------
with open('dashboard/index.html', 'r') as f:
    html = f.read()

# We replace the whole block from <div id="trello-not-connected"... to the end of <div id="trello-connected"...</div>
old_block_pattern = re.compile(r'<!-- Not connected -->.*?</div>\s*</div>\s*</div>\s*</div>\s*</section>', re.DOTALL)

restored_html = """<!-- Not connected -->
            <div id="trello-not-connected" class="flex flex-col items-center text-center p-10">
              <div class="w-24 h-24 rounded-3xl mb-6 flex items-center justify-center shadow-level-2" style="background:linear-gradient(135deg,#0052cc 0%,#1471e6 100%)">
                <svg viewBox="0 0 24 24" fill="white" class="w-12 h-12"><path d="M21 4a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V4zm-11.5 1.5h3a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zm5.5 0h2.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H15a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z"/></svg>
              </div>
              <h4 class="text-title-lg font-bold text-on-surface mb-2">Conectar ao Trello</h4>
              <p class="text-body-sm text-on-surface-variant max-w-sm mb-8 leading-relaxed">
                Autorize o dashboard a acessar seu Trello para sincronizar listas e cards de leads — sem editar nenhum arquivo.
              </p>

              <!-- API Key field -->
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
                <p class="text-label-md text-on-surface-variant">
                  Obtenha em:
                  <a href="https://trello.com/power-ups/admin" target="_blank" class="text-secondary hover:underline">trello.com/power-ups/admin</a>
                  → aba "API Key"
                </p>
              </div>

              <button id="trello-authorize-btn" onclick="authorizeTrello()"
                      class="trello-btn flex items-center space-x-3 px-8 py-4 rounded-xl text-body-sm font-semibold shadow-level-2">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 flex-shrink-0"><path d="M21 4a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V4zm-11.5 1.5h3a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zm5.5 0h2.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H15a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z"/></svg>
                <span>Entrar com Trello</span>
              </button>
            </div>

            <!-- Connected -->
            <div id="trello-connected" class="hidden">
              <!-- Profile header -->
              <div class="p-8 border-b border-outline-variant/50" style="background:linear-gradient(135deg,rgba(0,82,204,.04) 0%,rgba(20,113,230,.02) 100%)">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center space-x-4">
                    <div id="trello-avatar-wrap"
                         class="w-16 h-16 rounded-2xl overflow-hidden border-2 border-secondary/30 flex-shrink-0 bg-surface-container-high flex items-center justify-center text-title-lg font-bold text-secondary shadow-level-1">
                    </div>
                    <div>
                      <div class="flex flex-wrap items-center gap-2 mb-1">
                        <h4 id="trello-user-name" class="text-title-lg font-bold text-on-surface">—</h4>
                        <span class="badge badge-online">
                          <span class="w-1.5 h-1.5 rounded-full bg-status-online pulse-dot"></span>
                          Conectado
                        </span>
                      </div>
                      <p id="trello-user-username" class="text-body-sm text-on-surface-variant">@—</p>
                      <p id="trello-user-email" class="text-label-md text-on-surface-variant mt-1">—</p>
                    </div>
                  </div>
                  <button onclick="disconnectTrello()"
                          class="flex-shrink-0 flex items-center space-x-1.5 text-label-md text-on-surface-variant hover:text-status-offline hover:bg-red-50 px-3 py-2 rounded-full border border-outline-variant transition-all active:scale-95">
                    <span class="material-symbols-outlined text-[16px]">logout</span>
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>

              <!-- Boards -->
              <div class="p-8 border-b border-outline-variant/50">
                <p class="text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Boards disponíveis</p>
                <div id="trello-boards-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div class="skeleton h-14 rounded-xl"></div>
                  <div class="skeleton h-14 rounded-xl"></div>
                </div>
              </div>

              <!-- Token for n8n -->
              <div class="p-8">
                <p class="text-label-md text-on-surface-variant uppercase tracking-wider mb-3">Token para configurar no n8n</p>
                <div class="flex items-center gap-2">
                  <code id="trello-token-display" class="flex-1 text-body-sm font-mono bg-surface-container-low px-4 py-3 rounded-xl text-on-surface truncate border border-outline-variant">—</code>
                  <button onclick="copyTrelloToken()"
                          class="flex items-center space-x-1.5 text-label-md text-secondary hover:bg-surface-container-high px-3 py-3 rounded-xl border border-outline-variant transition active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">content_copy</span>
                    <span class="hidden sm:inline">Copiar</span>
                  </button>
                </div>
                <p class="text-label-md text-on-surface-variant mt-3">
                  Cole este token no campo <strong>Token</strong> das credenciais Trello no n8n, junto com sua API Key.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>"""

new_html = old_block_pattern.sub(restored_html, html)
with open('dashboard/index.html', 'w') as f:
    f.write(new_html)

# ----------------- REVERT APP.JS -----------------
with open('dashboard/app.js', 'r') as f:
    app_js = f.read()

# 1. Remove n8nApiKey from CONFIG
app_js = re.sub(r"n8nApiKey:\s*'COLOQUE_AQUI_A_SUA_API_KEY_DO_N8N',\n\s*n8nWorkflowId:\s*'wl1Dy5KQb0JzyBvf',\n\s*", "", app_js)

# 2. Restore checkTrelloLoginReturn (API key fallback)
# Actually the fallback was:
app_js = re.sub(
r"const lsKey = localStorage\.getItem\(TRELLO_LS_KEY_APIKEY\);\n\s*const apiKey = lsKey \|\| CONFIG\.trelloApiKey \|\| '';\n\s*if \(apiKey && apiKey !== 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO'\)",
"const lsKey = localStorage.getItem(TRELLO_LS_KEY_APIKEY);\n      const apiKey = lsKey || CONFIG.trelloApiKey || '';\n      if (apiKey && apiKey !== 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO')",
app_js)

# 3. Restore loadTrelloProfile (remove populate_select)
app_js = re.sub(r"state\.trelloBoards = boards;\n\s*// Populate board select.*?}\n", "state.trelloBoards = boards;\n", app_js, flags=re.DOTALL)

# 4. Remove the new functions onTrelloBoardSelect and syncTrelloToN8n
app_js = re.sub(r"// ─────────────────────────────────────────────\n// TRELLO BOARDS & LISTS.*?// ─────────────────────────────────────────────\n// INIT", "// ─────────────────────────────────────────────\n// INIT", app_js, flags=re.DOTALL)

# 5. Restore renderTrelloConnected
old_render_trello = re.search(r"function renderTrelloConnected\(\) \{.*?\n\}", app_js, re.DOTALL)
if old_render_trello:
    restored_render = """function renderTrelloConnected() {
  const panelNotConn = document.getElementById('trello-not-connected');
  const panelConn    = document.getElementById('trello-connected');
  if (!panelNotConn || !panelConn) return;

  panelNotConn.classList.add('hidden');
  panelConn.classList.remove('hidden');

  const user = state.trelloUser;
  if (!user) return;

  // Nome, username, email
  const nameEl  = document.getElementById('trello-user-name');
  const unEl    = document.getElementById('trello-user-username');
  const emailEl = document.getElementById('trello-user-email');
  if (nameEl)  nameEl.textContent  = user.fullName || '—';
  if (unEl)    unEl.textContent    = `@${user.username || '—'}`;
  if (emailEl) emailEl.textContent = user.email || '(email não disponível)';

  // Avatar
  const avatarWrap = document.getElementById('trello-avatar-wrap');
  if (avatarWrap) {
    if (user.avatarUrl) {
      const imgUrl = `${user.avatarUrl}/50.png`;
      avatarWrap.innerHTML = `<img src="${imgUrl}" alt="${user.fullName}" class="w-full h-full object-cover"/>`;
    } else {
      avatarWrap.textContent = (user.fullName || user.username || '?').slice(0, 2).toUpperCase();
    }
  }

  // Token para n8n
  const tokenDisplay = document.getElementById('trello-token-display');
  if (tokenDisplay) tokenDisplay.textContent = state.trelloToken || '—';

  // Boards list
  const boardsList = document.getElementById('trello-boards-list');
  if (boardsList) {
    if (state.trelloBoards.length === 0) {
      boardsList.innerHTML = '<p class="text-body-sm text-on-surface-variant col-span-full">Nenhum board encontrado.</p>';
    } else {
      boardsList.innerHTML = state.trelloBoards.map(b => {
        const bg = b.prefs?.backgroundColor || b.prefs?.backgroundTopColor || '#0052cc';
        return `
          <a href="${b.url}" target="_blank" rel="noopener"
             class="flex items-center space-x-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container-low transition group">
            <div class="w-8 h-8 rounded-lg flex-shrink-0" style="background:${bg}"></div>
            <span class="text-body-sm text-on-surface font-medium group-hover:text-secondary transition truncate">${b.name}</span>
            <span class="material-symbols-outlined text-[14px] text-on-surface-variant ml-auto flex-shrink-0">open_in_new</span>
          </a>`;
      }).join('');
    }
  }
}"""
    app_js = app_js.replace(old_render_trello.group(0), restored_render)

with open('dashboard/app.js', 'w') as f:
    f.write(app_js)

print("Reverted to previous state!")
