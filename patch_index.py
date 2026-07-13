import re

with open('dashboard/index.html', 'r') as f:
    content = f.read()

old_trello_section = re.search(r'<!-- === CONEXÕES === -->.*?<!-- === BROKERS === -->', content, re.DOTALL)
if old_trello_section:
    new_trello_section = """<!-- === CONEXÕES === -->
      <section id="section-connections" class="hidden space-y-10 fade-in">
        <div>
          <h2 class="text-headline-md text-on-surface">Conexões</h2>
          <p class="text-body-sm text-on-surface-variant mt-1">Gerencie WhatsApp e Trello sem editar arquivos de configuração.</p>
        </div>

        <!-- ── WhatsApp ───────────────────────────────────────────── -->
        <div class="space-y-5">
          <!-- Section header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:#25d366">
                <svg viewBox="0 0 24 24" fill="white" class="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.478 2 12.001c0 1.772.463 3.435 1.27 4.883L2 22l5.228-1.253A9.923 9.923 0 0 0 12 22c5.522 0 10-4.478 10-10S17.521 2 12 2zm0 18.18a8.171 8.171 0 0 1-4.434-1.307l-.317-.19-3.105.745.77-3.017-.207-.33A8.174 8.174 0 0 1 3.82 12c0-4.513 3.667-8.18 8.18-8.18 4.513 0 8.18 3.667 8.18 8.18 0 4.513-3.667 8.18-8.18 8.18z"/></svg>
              </div>
              <div>
                <h3 class="text-title-lg font-semibold text-on-surface">WhatsApp — Evolution API</h3>
                <p class="text-label-md text-on-surface-variant">Instâncias conectadas e QR Codes para reconexão</p>
              </div>
            </div>
            <button onclick="refreshEvolutionInstances()" id="evo-refresh-btn"
                    class="flex items-center space-x-1.5 text-label-md text-secondary hover:bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant transition-all active:scale-95">
              <span class="material-symbols-outlined text-[16px]" id="evo-refresh-icon">refresh</span>
              <span>Atualizar</span>
            </button>
          </div>

          <!-- Instance cards -->
          <div id="evolution-instances-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-card-gap">
            <div class="skeleton h-80 rounded-xl"></div>
            <div class="skeleton h-80 rounded-xl"></div>
          </div>
        </div>

        <!-- Divider -->
        <hr class="border-outline-variant/50"/>

        <!-- ── Trello OAuth ───────────────────────────────────────── -->
        <div class="space-y-5">
          <!-- Section header -->
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:#0052cc">
              <svg viewBox="0 0 24 24" fill="white" class="w-5 h-5"><path d="M21 4a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V4zm-11.5 1.5h3a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zm5.5 0h2.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H15a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z"/></svg>
            </div>
            <div>
              <h3 class="text-title-lg font-semibold text-on-surface">Trello</h3>
              <p class="text-label-md text-on-surface-variant">Autorize o acesso para configurar os quadros e colunas de forma totalmente visual.</p>
            </div>
          </div>

          <!-- Panel -->
          <div class="bg-surface-container-lowest rounded-2xl border border-surface-container-highest shadow-level-1 overflow-hidden">

            <!-- Not connected -->
            <div id="trello-not-connected" class="flex flex-col items-center text-center p-10">
              <div class="w-24 h-24 rounded-3xl mb-6 flex items-center justify-center shadow-level-2" style="background:linear-gradient(135deg,#0052cc 0%,#1471e6 100%)">
                <svg viewBox="0 0 24 24" fill="white" class="w-12 h-12"><path d="M21 4a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V4zm-11.5 1.5h3a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zm5.5 0h2.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H15a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z"/></svg>
              </div>
              <h4 class="text-title-lg font-bold text-on-surface mb-2">Conectar ao Trello</h4>
              <p class="text-body-sm text-on-surface-variant max-w-sm mb-8 leading-relaxed">
                Autorize o dashboard a acessar seu Trello para configurar os quadros e colunas de forma visual.
              </p>

              <button id="trello-authorize-btn" onclick="authorizeTrello()"
                      class="trello-btn flex items-center space-x-3 px-8 py-4 rounded-xl text-body-sm font-semibold shadow-level-2">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 flex-shrink-0"><path d="M21 4a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V4zm-11.5 1.5h3a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zm5.5 0h2.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H15a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z"/></svg>
                <span>Entrar com Trello</span>
              </button>
              <p class="text-[12px] text-on-surface-variant/70 mt-4"><span class="material-symbols-outlined text-[14px] align-middle mr-1">lock</span>Autorização segura.</p>
            </div>

            <!-- Connected -->
            <div id="trello-connected" class="hidden flex flex-col md:flex-row p-6 md:p-8 gap-8 items-start relative">
              <button onclick="disconnectTrello()" class="absolute top-4 right-4 text-on-surface-variant hover:text-error transition-colors p-2 bg-surface-container-high rounded-full hover:bg-error-container" title="Desconectar">
                <span class="material-symbols-outlined text-[20px]">logout</span>
              </button>

              <div class="flex-shrink-0 flex flex-col items-center">
                <img id="trello-avatar" src="" alt="Avatar" class="w-20 h-20 rounded-full shadow-md object-cover border-2 border-surface">
                <span id="trello-name" class="mt-3 font-semibold text-title-lg text-on-surface">—</span>
                <span id="trello-user" class="text-label-md text-on-surface-variant">@—</span>
              </div>

              <div class="flex-1 w-full space-y-6 pt-2">
                <div>
                  <h4 class="text-label-md text-primary font-bold mb-2 uppercase tracking-wider">Passo 1: Copie o Token</h4>
                  <p class="text-body-sm text-on-surface-variant mb-2">Cole este token nas Credenciais Trello do n8n.</p>
                  <div class="flex items-center space-x-2">
                    <input type="text" id="trello-token-display" readonly class="flex-1 bg-surface-container border border-outline-variant text-on-surface text-body-sm font-mono rounded-lg px-3 py-2 outline-none">
                    <button onclick="copyTrelloToken()" class="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md font-medium hover:bg-on-primary-container transition shadow-sm active:scale-95 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[16px]">content_copy</span> Copiar
                    </button>
                  </div>
                </div>

                <div class="border-t border-outline-variant/30 pt-6">
                  <h4 class="text-label-md text-primary font-bold mb-2 uppercase tracking-wider">Passo 2: Configurar Board e Coluna</h4>
                  <p class="text-body-sm text-on-surface-variant mb-4">Escolha onde os leads devem ser criados e atualize o n8n com 1 clique.</p>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-label-md text-on-surface-variant mb-1">Board do Trello</label>
                      <select id="trello-board-select" onchange="onTrelloBoardSelect()" class="w-full bg-surface-container border border-outline-variant text-on-surface text-body-sm rounded-lg px-3 py-2 outline-none focus:border-primary">
                        <option value="">Carregando boards...</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-label-md text-on-surface-variant mb-1">Coluna de Leads</label>
                      <select id="trello-list-select" class="w-full bg-surface-container border border-outline-variant text-on-surface text-body-sm rounded-lg px-3 py-2 outline-none focus:border-primary">
                        <option value="">Selecione um board primeiro</option>
                      </select>
                    </div>
                  </div>

                  <button id="btn-sync-n8n" onclick="syncTrelloToN8n()" class="mt-5 w-full bg-primary text-on-primary py-3 rounded-lg text-body-sm font-semibold hover:bg-on-surface transition shadow-sm active:scale-95 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">sync</span> Atualizar IDs no Workflow do n8n automaticamente
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <!-- === BROKERS === -->\n"""
    
    with open('dashboard/index.html', 'w') as f:
        f.write(content.replace(old_trello_section.group(0), new_trello_section))
    print("Patched index.html")
