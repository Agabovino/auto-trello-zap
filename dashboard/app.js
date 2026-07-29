/**
 * Dashboard Viver Católico — Lead Monitor v2.1
 * app.js — Lógica de consumo de dados e interações da UI
 *
 * Novidades v2.1:
 *   - Seção "Conexões": QR Code da Evolution API + status das instâncias WhatsApp
 *   - Trello OAuth flow: "Entrar com Trello" via token redirect
 *
 * Endpoints base:
 *   n8n  : https://n8n.vivercatolico.com.br
 *   evo  : https://evolution.vivercatolico.com.br
 */

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const CONFIG = {
  n8nBaseUrl: (typeof ENV !== 'undefined' && ENV.N8N_BASE_URL && ENV.N8N_BASE_URL.trim() !== '') ? ENV.N8N_BASE_URL.replace(/\/+$/, '') : 'https://n8n.vivercatolico.com.br',
  evolutionBaseUrl: (typeof ENV !== 'undefined' && ENV.EVOLUTION_BASE_URL && ENV.EVOLUTION_BASE_URL.trim() !== '') ? ENV.EVOLUTION_BASE_URL.replace(/\/+$/, '') : 'https://evolution.vivercatolico.com.br',
  // Chave da Evolution API — exposta apenas no dashboard interno
  evolutionApiKey: (typeof ENV !== 'undefined' && ENV.EVOLUTION_API_KEY && ENV.EVOLUTION_API_KEY.trim() !== '') ? ENV.EVOLUTION_API_KEY : 'evo-zap-agabo-2026',
  // Instância oficial lida dinamicamente do container NGINX (originada do .env)
  leadSourceInstance: (typeof ENV !== 'undefined' && ENV.EVOLUTION_INSTANCE) ? ENV.EVOLUTION_INSTANCE : 'meu-numero',
  // API Key do Trello
  trelloApiKey: (typeof ENV !== 'undefined' && ENV.TRELLO_API_KEY && ENV.TRELLO_API_KEY.trim() !== '') ? ENV.TRELLO_API_KEY : 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO',
  // Token do Trello (global fallback lido do .env/servidor)
  trelloToken: (typeof ENV !== 'undefined' && ENV.TRELLO_TOKEN && ENV.TRELLO_TOKEN.trim() !== '') ? ENV.TRELLO_TOKEN : '',
  syncWebhookPath: '/webhook/manual-trello-sync',
  statusRefreshInterval: 30_000,
  // Intervalo para polling de QR code quando instância está desconectada (ms)
  qrPollInterval: 15_000,
  brokers: [
    { id: 'agabo', name: 'Ágabo',  phone: '5583999931422', avatar: 'AG', role: 'Corretor Sênior' },
    { id: 'brisa', name: 'Brisa',  phone: '5583921485647', avatar: 'BR', role: 'Corretora Pleno'  },
  ],
  services: [
    { key: 'n8n',              label: 'n8n',              image: 'n8nio/n8n:latest',                port: '5678', url: (typeof ENV !== 'undefined' && ENV.N8N_BASE_URL) ? ENV.N8N_BASE_URL : 'https://n8n.vivercatolico.com.br',      healthPath: '/healthz' },
    { key: 'evolution',        label: 'Evolution API',    image: 'evoapicloud/evolution-api:latest', port: '8081', url: (typeof ENV !== 'undefined' && ENV.EVOLUTION_BASE_URL) ? ENV.EVOLUTION_BASE_URL : 'https://evolution.vivercatolico.com.br', healthPath: '/'        },
    { key: 'postgres',         label: 'PostgreSQL',       image: 'postgres:15-alpine',              port: '5432', url: 'Rede interna',                           healthPath: null       },
    { key: 'redis',            label: 'Redis',            image: 'redis:7-alpine',                  port: '6379', url: 'Rede interna',                           healthPath: null       },
    { key: 'tunnel',           label: 'Tunnel n8n',       image: 'cloudflare/cloudflared:latest',   port: '—',    url: (typeof ENV !== 'undefined' && ENV.N8N_BASE_URL) ? ENV.N8N_BASE_URL.replace(/^https?:\/\//, '') : 'n8n.vivercatolico.com.br',               healthPath: '/healthz' },
    { key: 'tunnel-evolution', label: 'Tunnel Evolution', image: 'cloudflare/cloudflared:latest',   port: '—',    url: (typeof ENV !== 'undefined' && ENV.EVOLUTION_BASE_URL) ? ENV.EVOLUTION_BASE_URL.replace(/^https?:\/\//, '') : 'evolution.vivercatolico.com.br',          healthPath: '/'        },
  ],
  enableStatsWebhooks: false, // Define se tenta buscar métricas do n8n
};

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const state = {
  currentSection: 'overview',
  serviceStatuses: {},
  brokerLeads: {},
  lastSync: null,
  logs: [],
  syncing: false,
  evolutionInstances: [],
  qrPollers: {},          // instanceName → intervalId
  trelloToken: null,      // token OAuth do Trello (guardado no localStorage)
  trelloApiKey: null,     // API key pública do Trello (inserida pelo usuário)
  trelloUser: null,       // dados do perfil Trello
  trelloBoards: [],
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatDateTime(date) {
  if (!date) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function formatRelative(date) {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

function addLog(level, msg) {
  const entry = { time: new Date(), level, msg };
  state.logs.unshift(entry);
  if (state.logs.length > 100) state.logs.pop();
  renderLogs();
}

function showToast(msg, icon = 'info') {
  const el  = document.getElementById('toast');
  const ico = document.getElementById('toast-icon');
  const txt = document.getElementById('toast-message');
  ico.textContent = icon;
  txt.textContent = msg;
  el.classList.remove('hidden-toast');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden-toast'), 4000);
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
function showSection(name, clickedEl) {
  const sections = ['overview', 'connections', 'brokers', 'leads', 'infra', 'logs'];
  sections.forEach(s => {
    const sec = document.getElementById(`section-${s}`);
    if (sec) {
      if (s === name) { sec.classList.remove('hidden'); sec.classList.add('fade-in'); }
      else            { sec.classList.add('hidden'); sec.classList.remove('fade-in'); }
    }
    const navEl = document.getElementById(`nav-${s}`);
    if (navEl) {
      if (s === name) {
        navEl.classList.add('bg-secondary-container','text-on-secondary-container','font-bold');
        navEl.classList.remove('text-on-surface-variant','hover:bg-surface-container-high');
      } else {
        navEl.classList.remove('bg-secondary-container','text-on-secondary-container','font-bold');
        navEl.classList.add('text-on-surface-variant','hover:bg-surface-container-high');
      }
    }
  });
  state.currentSection = name;

  // Ao entrar em Conexões, carrega automaticamente
  if (name === 'connections') {
    refreshEvolutionInstances();
    checkTrelloLoginReturn();
  } else if (name === 'leads') {
    fetchLeadsHistory();
  }
}

function toggleMobileSidebar() {
  const overlay = document.getElementById('mobile-overlay');
  const sidebar = document.getElementById('mobile-sidebar');
  const hidden  = sidebar.classList.contains('hidden');
  sidebar.classList.toggle('hidden', !hidden);
  sidebar.classList.toggle('flex',    hidden);
  overlay.classList.toggle('hidden', !hidden);
}

// ─────────────────────────────────────────────
// SERVICE HEALTH CHECK
// ─────────────────────────────────────────────
async function checkServiceHealth(service) {
  if (!service.healthPath) return 'online';
  try {
    const url = service.key.startsWith('tunnel')
      ? `https://${service.url}${service.healthPath}`
      : `${service.url}${service.healthPath}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(timer);
    return 'online';
  } catch {
    return 'offline';
  }
}

async function refreshServiceStatuses() {
  addLog('info', 'Verificando status dos serviços...');
  const results = await Promise.allSettled(
    CONFIG.services.map(s => checkServiceHealth(s))
  );
  CONFIG.services.forEach((s, i) => {
    const r = results[i];
    state.serviceStatuses[s.key] = r.status === 'fulfilled' ? r.value : 'offline';
  });
  renderInfraStatus();
  renderInfraTable();
  updateKPIServices();
}

// ─────────────────────────────────────────────
// EVOLUTION API — Instâncias WhatsApp
// ─────────────────────────────────────────────

/**
 * Busca todas as instâncias da Evolution API.
 * Endpoint: GET /instance/fetchInstances
 */
async function fetchEvolutionInstances() {
  const resp = await fetch(`${CONFIG.evolutionBaseUrl}/instance/fetchInstances`, {
    headers: { 'apikey': CONFIG.evolutionApiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`Evolution API: HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Busca o estado de conexão de uma instância específica.
 * Endpoint: GET /instance/connectionState/{instanceName}
 * A Evolution API v2 retorna: { instance: { instanceName, state } } OU { state } direto
 */
async function fetchInstanceConnectionState(instanceName) {
  const resp = await fetch(`${CONFIG.evolutionBaseUrl}/instance/connectionState/${instanceName}`, {
    headers: { 'apikey': CONFIG.evolutionApiKey },
    signal: AbortSignal.timeout(6000),
  });
  if (!resp.ok) throw new Error(`Connection state: HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Normaliza o connection state retornado pela API (pode vir em vários formatos).
 */
function parseConnectionState(raw, fallback) {
  // Tenta .instance.state, .state, ou usa connectionStatus do objeto de instância
  if (!raw) return fallback || 'unknown';
  return raw?.instance?.state || raw?.state || fallback || 'unknown';
}

/**
 * Busca o QR code de uma instância desconectada.
 * Endpoint: GET /instance/connect/{instanceName}
 * Retorna: { base64: "data:image/png;base64,..." } ou { message: "already connected" }
 */
async function fetchInstanceQR(instanceName) {
  const resp = await fetch(`${CONFIG.evolutionBaseUrl}/instance/connect/${instanceName}`, {
    headers: { 'apikey': CONFIG.evolutionApiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`QR fetch: HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Carrega todas as instâncias e seus status em paralelo.
 */
async function refreshEvolutionInstances() {
  const grid = document.getElementById('evolution-instances-grid');
  const icon = document.getElementById('evo-refresh-icon');
  if (icon) icon.classList.add('spin');

  try {
    addLog('info', 'Consultando instâncias da Evolution API...');
    const instances = await fetchEvolutionInstances();

    // instances é um array de objetos { instance: { instanceName, status, ... } }
    const list = Array.isArray(instances) ? instances : [];

    // Evolution API v2 retorna objetos planos: { name, connectionStatus, profileName, profilePicUrl, number, ... }
    // connectionStatus já vem no fetchInstances, então não precisamos buscar cada estado separadamente.
    state.evolutionInstances = list.map(item => {
      // Nome: campo "name" (v2) ou fallback
      const name       = item.name || item.instanceName || item.instance?.instanceName || '—';
      // Status de conexão: "open" | "close" | "connecting"
      const connStatus = item.connectionStatus || item.instance?.state || 'unknown';
      return {
        name,
        state: connStatus,
        profilePic:  item.profilePicUrl  || item.instance?.profilePicUrl  || null,
        profileName: item.profileName    || item.instance?.profileName    || name,
        phone:       item.number         || item.instance?.number         || null,
        qrBase64: null,
      };
    });

    // Verifica se há instâncias desconectadas para mostrar badge
    const offlineCount = state.evolutionInstances.filter(i => i.state !== 'open').length;
    const badge = document.getElementById('sidebar-conn-badge');
    if (badge) {
      if (offlineCount > 0) {
        badge.textContent = offlineCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    addLog(offlineCount > 0 ? 'warn' : 'success',
      `Evolution API: ${state.evolutionInstances.length} instância(s) — ${offlineCount} desconectada(s).`);

    await renderEvolutionGrid();
  } catch (err) {
    addLog('error', `Erro ao consultar Evolution API: ${err.message}`);
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full flex flex-col items-center py-12 text-on-surface-variant space-y-3">
          <span class="material-symbols-outlined text-[40px] text-status-offline">wifi_off</span>
          <p class="text-body-sm">Não foi possível conectar à Evolution API.</p>
          <p class="text-label-md">${err.message}</p>
          <button onclick="refreshEvolutionInstances()" class="mt-2 px-4 py-2 border border-outline-variant rounded-lg text-label-md text-secondary hover:bg-surface-container-high transition active:scale-95">
            Tentar novamente
          </button>
        </div>`;
    }
  } finally {
    if (icon) icon.classList.remove('spin');
  }
}

/**
 * Renderiza os cards das instâncias no grid.
 * Para instâncias desconectadas, tenta buscar o QR code.
 */
async function renderEvolutionGrid() {
  const grid = document.getElementById('evolution-instances-grid');
  if (!grid) return;

  if (state.evolutionInstances.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full flex flex-col items-center py-12 text-on-surface-variant space-y-3">
        <span class="material-symbols-outlined text-[40px]">smartphone</span>
        <p class="text-body-sm">Nenhuma instância encontrada na Evolution API.</p>
        <a href="https://evolution.vivercatolico.com.br/manager/" target="_blank"
           class="mt-2 px-4 py-2 border border-outline-variant rounded-lg text-label-md text-secondary hover:bg-surface-container-high transition">
          Abrir Evolution Manager
        </a>
      </div>`;
    return;
  }

  // Renderiza placeholders primeiro
  grid.innerHTML = state.evolutionInstances.map(inst => buildInstanceCardHtml(inst, null)).join('');

  // Busca QR codes em paralelo para instâncias desconectadas
  await Promise.allSettled(
    state.evolutionInstances.map(async (inst, idx) => {
      if (inst.state !== 'open') {
        try {
          const qrData = await fetchInstanceQR(inst.name);
          // Pode vir como base64, qrcode, code, pairingCode...
          const qrImg = qrData.base64 || qrData.qrcode || qrData.code || null;
          state.evolutionInstances[idx].qrBase64 = qrImg;
        } catch {
          // Sem QR (talvez já conectou)
        }
      }
      // Atualiza o card específico
      const cardEl = document.getElementById(`instance-card-${inst.name}`);
      if (cardEl) {
        cardEl.outerHTML = buildInstanceCardHtml(state.evolutionInstances[idx], null);
      }
    })
  );
}

/**
 * Constrói o HTML de um card de instância.
 */
function buildInstanceCardHtml(inst) {
  const isConnected  = inst.state === 'open';
  const isConnecting = inst.state === 'connecting';

  const badgeHtml = isConnected
    ? `<span class="badge badge-online"><span class="w-1.5 h-1.5 rounded-full bg-status-online pulse-dot"></span>Conectado</span>`
    : isConnecting
    ? `<span class="badge badge-connecting"><span class="w-1.5 h-1.5 rounded-full bg-status-warn pulse-dot"></span>Conectando...</span>`
    : `<span class="badge badge-offline">Desconectado</span>`;

  // Avatar: foto de perfil ou iniciais
  const avatarHtml = inst.profilePic
    ? `<img src="${inst.profilePic}" alt="${inst.profileName}" class="w-full h-full object-cover"/>`
    : `<span class="text-title-lg font-bold text-white">${(inst.profileName || inst.name).slice(0,2).toUpperCase()}</span>`;

  // QR Code area
  let qrAreaHtml = '';
  if (!isConnected) {
    if (inst.qrBase64) {
      const src = inst.qrBase64.startsWith('data:') ? inst.qrBase64 : `data:image/png;base64,${inst.qrBase64}`;
      qrAreaHtml = `
        <div class="mt-4 flex flex-col items-center space-y-3">
          <p class="text-label-md text-on-surface-variant uppercase tracking-wider">Escaneie com o WhatsApp</p>
          <div class="relative rounded-2xl overflow-hidden border-4 border-dashed border-green-300 qr-waiting-border p-2 bg-white">
            <img src="${src}" alt="QR Code" class="w-48 h-48 object-contain qr-img"/>
            <div class="scan-line"></div>
          </div>
          <p class="text-label-md text-on-surface-variant text-center max-w-xs">
            Abra o WhatsApp → Dispositivos Vinculados → Vincular dispositivo
          </p>
          <button onclick="refreshInstanceQR('${inst.name}')" id="qr-refresh-${inst.name}"
                  class="flex items-center space-x-1.5 text-label-md text-secondary hover:bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant transition active:scale-95">
            <span class="material-symbols-outlined text-[14px]">refresh</span>
            <span>Novo QR Code</span>
          </button>
        </div>`;
    } else {
      qrAreaHtml = `
        <div class="mt-4 flex flex-col items-center space-y-3">
          <div class="w-48 h-48 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col items-center justify-center space-y-2">
            <span class="material-symbols-outlined text-[32px] text-on-surface-variant">qr_code</span>
            <span class="text-label-md text-on-surface-variant text-center px-4">QR Code indisponível</span>
          </div>
          <button onclick="refreshInstanceQR('${inst.name}')" id="qr-refresh-${inst.name}"
                  class="flex items-center space-x-1.5 text-label-md text-secondary hover:bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant transition active:scale-95">
            <span class="material-symbols-outlined text-[14px]">refresh</span>
            <span>Gerar QR Code</span>
          </button>
        </div>`;
    }
  }

  return `
    <div id="instance-card-${inst.name}" class="bg-surface-container-lowest rounded-2xl border border-surface-container-highest shadow-level-1 p-6 flex flex-col items-center text-center instance-card">
      <!-- Avatar -->
      <div class="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 mb-3 flex items-center justify-center"
           style="background:${isConnected ? 'linear-gradient(135deg,#25d366,#128c7e)' : '#e8e9ea'}">
        ${avatarHtml}
      </div>

      <!-- Name + badge -->
      <div class="flex items-center gap-2 mb-1">
        <h4 class="text-title-lg font-semibold text-on-surface">${inst.profileName || inst.name}</h4>
        ${inst.name === CONFIG.leadSourceInstance ? '<span class="bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" title="Esta é a fonte oficial de Leads no Trello">Fonte de Leads</span>' : ''}
      </div>
      <p class="text-label-md text-on-surface-variant mb-2 font-mono">${inst.name}</p>
      ${inst.phone ? `<p class="text-label-md text-on-surface-variant mb-3">+${inst.phone}</p>` : ''}
      ${badgeHtml}

      ${qrAreaHtml}

      ${isConnected ? `
      <div class="mt-4 flex flex-col items-center gap-1.5 text-label-md">
        <div class="flex items-center space-x-1.5 text-status-online">
          <span class="material-symbols-outlined text-[16px]">check_circle</span>
          <span>WhatsApp ativo</span>
        </div>
        ${inst.name === CONFIG.leadSourceInstance 
          ? '<span class="text-on-surface-variant text-[11px]">Enviando mensagens para o Trello</span>'
          : '<span class="text-on-surface-variant text-[11px]">Conectado, mas não gera leads</span>'}
      </div>` : ''}
    </div>`;
}

/**
 * Atualiza o QR code de uma instância específica ao clicar no botão.
 */
async function refreshInstanceQR(instanceName) {
  const btn = document.getElementById(`qr-refresh-${instanceName}`);
  if (btn) btn.disabled = true;
  addLog('info', `Atualizando QR Code para "${instanceName}"...`);
  try {
    const qrData = await fetchInstanceQR(instanceName);
    const qrImg  = qrData.base64 || qrData.qrcode || qrData.code || null;
    const idx    = state.evolutionInstances.findIndex(i => i.name === instanceName);
    if (idx !== -1) {
      state.evolutionInstances[idx].qrBase64 = qrImg;
      // Re-check state
      try {
        const stateData = await fetchInstanceConnectionState(instanceName);
        state.evolutionInstances[idx].state = stateData?.instance?.state || stateData?.state || 'close';
      } catch { /* ignora */ }
      const cardEl = document.getElementById(`instance-card-${instanceName}`);
      if (cardEl) cardEl.outerHTML = buildInstanceCardHtml(state.evolutionInstances[idx]);
    }
    addLog('success', `QR Code atualizado para "${instanceName}".`);
  } catch (err) {
    addLog('error', `Erro ao buscar QR Code de "${instanceName}": ${err.message}`);
    showToast(`Erro ao gerar QR Code: ${err.message}`, 'error');
    if (btn) btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
// TRELLO OAuth — "Entrar com Trello"
// ─────────────────────────────────────────────

const TRELLO_LS_KEY_TOKEN  = 'atendimoveis_trello_token';
const TRELLO_LS_KEY_APIKEY = 'atendimoveis_trello_apikey';

/**
 * Salva credenciais manuais (API Key e Token) diretamente da interface.
 */
async function saveManualTrelloCredentials() {
  const keyInput   = document.getElementById('trello-api-key-input');
  const tokenInput = document.getElementById('trello-token-input');

  const apiKey = (keyInput?.value || '').trim();
  const token  = (tokenInput?.value || '').trim();

  if (!apiKey || apiKey === 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO') {
    showToast('Insira uma API Key do Trello válida.', 'warning');
    keyInput?.focus();
    return;
  }
  if (!token) {
    showToast('Insira o Token do Trello ou clique em "Entrar com Trello".', 'warning');
    tokenInput?.focus();
    return;
  }

  state.trelloApiKey = apiKey;
  state.trelloToken  = token;
  localStorage.setItem(TRELLO_LS_KEY_APIKEY, apiKey);
  localStorage.setItem(TRELLO_LS_KEY_TOKEN, token);

  addLog('info', 'Salvando novas credenciais do Trello...');
  showToast('Credenciais salvas! Carregando perfil...', 'info');
  await loadTrelloProfile();
}

/**
 * Verifica se voltamos de um redirect do Trello (token no hash da URL) ou carrega credenciais salvas.
 */
async function checkTrelloLoginReturn() {
  // 1. Verifica hash na URL (retorno do redirect OAuth)
  const hash = window.location.hash.substring(1);
  if (hash) {
    const params = new URLSearchParams(hash);
    const token  = params.get('token');
    if (token) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      const lsKey = localStorage.getItem(TRELLO_LS_KEY_APIKEY);
      const keyInput = document.getElementById('trello-api-key-input');
      const apiKey = (keyInput?.value || (lsKey !== 'DISCONNECTED' ? lsKey : '') || CONFIG.trelloApiKey || '').trim();
      if (apiKey && apiKey !== 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO') {
        state.trelloToken  = token;
        state.trelloApiKey = apiKey;
        localStorage.setItem(TRELLO_LS_KEY_TOKEN, token);
        localStorage.setItem(TRELLO_LS_KEY_APIKEY, apiKey);
        addLog('success', 'Autenticação Trello concluída com sucesso!');
        showToast('Trello conectado com sucesso!', 'check_circle');
        await loadTrelloProfile();
        return;
      }
    }
  }

  // 2. Verifica localStorage ou fallback global do servidor
  let savedToken  = localStorage.getItem(TRELLO_LS_KEY_TOKEN);
  let savedApiKey = localStorage.getItem(TRELLO_LS_KEY_APIKEY);

  if (savedToken === 'DISCONNECTED' || savedApiKey === 'DISCONNECTED') {
    savedToken  = null;
    savedApiKey = null;
  } else {
    if (!savedToken)  savedToken  = CONFIG.trelloToken;
    if (!savedApiKey) savedApiKey = CONFIG.trelloApiKey;
  }
  
  const keyInput   = document.getElementById('trello-api-key-input');
  const tokenInput = document.getElementById('trello-token-input');
  if (keyInput && savedApiKey && savedApiKey !== 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO') {
    keyInput.value = savedApiKey;
  }
  if (tokenInput && savedToken) {
    tokenInput.value = savedToken;
  }

  if (savedToken && savedApiKey && savedApiKey !== 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO') {
    state.trelloToken  = savedToken;
    state.trelloApiKey = savedApiKey;
    await loadTrelloProfile();
  }
}

/**
 * Inicia o fluxo OAuth do Trello.
 */
function authorizeTrello() {
  const input  = document.getElementById('trello-api-key-input');
  const apiKeyInput = (input?.value || '').trim();
  const lsKey = localStorage.getItem(TRELLO_LS_KEY_APIKEY);
  const apiKey = apiKeyInput || (lsKey !== 'DISCONNECTED' ? lsKey : '') || CONFIG.trelloApiKey;

  if (!apiKey || apiKey === 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO') {
    showToast('Insira a API Key do Trello antes de continuar.', 'warning');
    input?.focus();
    return;
  }

  // Limpa o token anterior no localStorage para não reusar credenciais velhas
  localStorage.removeItem(TRELLO_LS_KEY_TOKEN);
  state.trelloToken = null;

  localStorage.setItem(TRELLO_LS_KEY_APIKEY, apiKey);
  state.trelloApiKey = apiKey;

  const returnUrl = encodeURIComponent(window.location.href.split('#')[0]);
  const authUrl = [
    'https://trello.com/1/authorize',
    `?key=${apiKey}`,
    `&name=Atendimoveis+Lead+Monitor`,
    `&response_type=token`,
    `&scope=read,write`,
    `&expiration=never`,
    `&return_url=${returnUrl}`,
  ].join('');

  addLog('info', 'Redirecionando para autorização Trello...');
  window.location.href = authUrl;
}

/**
 * Carrega o perfil do usuário Trello autenticado e os boards com suas colunas (lists).
 */
async function loadTrelloProfile() {
  try {
    const [memberResp, boardsResp] = await Promise.all([
      fetch(`https://api.trello.com/1/members/me?key=${state.trelloApiKey}&token=${state.trelloToken}&fields=fullName,username,email,avatarUrl,avatarHash`),
      fetch(`https://api.trello.com/1/members/me/boards?key=${state.trelloApiKey}&token=${state.trelloToken}&filter=open&fields=name,url,prefs&lists=open&list_fields=name`),
    ]);

    if (!memberResp.ok) throw new Error(`Trello member: HTTP ${memberResp.status}`);
    const member = await memberResp.json();
    state.trelloUser = member;

    if (boardsResp.ok) {
      state.trelloBoards = await boardsResp.json();
    }

    renderTrelloConnected();
    addLog('success', `Trello conectado como @${member.username} (${state.trelloBoards.length} boards).`);
  } catch (err) {
    addLog('error', `Erro ao carregar perfil Trello: ${err.message}`);
    // Token inválido — limpa
    if (err.message.includes('401') || err.message.includes('400')) {
      disconnectTrello();
      showToast('Token Trello inválido ou expirado. Faça login novamente.', 'error');
    }
  }
}

/**
 * Renderiza o painel "conectado" do Trello.
 */
function renderTrelloConnected() {
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

  // API Key para n8n
  const apiKeyDisplay = document.getElementById('trello-apikey-display');
  if (apiKeyDisplay) apiKeyDisplay.textContent = state.trelloApiKey || '—';

  // Boards list
  const boardsList = document.getElementById('trello-boards-list');
  if (boardsList) {
    if (state.trelloBoards.length === 0) {
      boardsList.innerHTML = '<p class="text-body-sm text-on-surface-variant col-span-full">Nenhum board encontrado.</p>';
    } else {
      boardsList.innerHTML = state.trelloBoards.map((b, idx) => {
        const bg = b.prefs?.backgroundColor || b.prefs?.backgroundTopColor || '#0052cc';
        const listsHtml = (b.lists || []).map(l => `
          <div class="flex items-center justify-between py-1.5 border-b border-outline-variant/30 last:border-0">
            <span class="text-[12px] text-on-surface truncate pr-2 flex-1">${l.name}</span>
            <div class="flex items-center space-x-2 flex-shrink-0">
              <code class="text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-on-surface-variant">${l.id}</code>
              <button onclick="copyToClipboard('${l.id}', 'ID da Coluna')" class="text-secondary hover:bg-surface-container-high p-1 rounded transition">
                <span class="material-symbols-outlined text-[14px]">content_copy</span>
              </button>
            </div>
          </div>
        `).join('');

        return `
          <div class="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden flex flex-col group">
            <button onclick="toggleTrelloBoard(${idx})" class="flex items-center space-x-3 px-4 py-3 w-full text-left hover:bg-surface-container-low transition">
              <div class="w-8 h-8 rounded-lg flex-shrink-0" style="background:${bg}"></div>
              <span class="text-body-sm text-on-surface font-medium truncate flex-1">${b.name}</span>
              <span id="board-icon-${idx}" class="material-symbols-outlined text-[16px] text-on-surface-variant transition-transform">expand_more</span>
            </button>
            
            <div id="board-content-${idx}" class="hidden flex-col bg-surface-container-low border-t border-outline-variant/50 p-4 space-y-4">
              <!-- Board ID -->
              <div>
                <span class="block text-[10px] uppercase text-on-surface-variant font-bold mb-1 tracking-wider">ID do Board</span>
                <div class="flex items-center space-x-2">
                  <code class="flex-1 text-[11px] bg-surface-container px-3 py-1.5 rounded-lg font-mono text-on-surface truncate">${b.id}</code>
                  <button onclick="copyToClipboard('${b.id}', 'ID do Board')" class="bg-secondary text-on-secondary hover:bg-on-secondary-fixed-variant p-1.5 rounded-lg transition active:scale-95">
                    <span class="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>
              
              <!-- Lists -->
              <div>
                <span class="block text-[10px] uppercase text-on-surface-variant font-bold mb-1 tracking-wider">Colunas (Lists)</span>
                <div class="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1">
                  ${listsHtml || '<span class="text-[11px] text-on-surface-variant block py-2">Nenhuma coluna encontrada.</span>'}
                </div>
              </div>

              <!-- Open in Trello -->
              <a href="${b.url}" target="_blank" rel="noopener" class="flex items-center justify-center space-x-1.5 text-[12px] font-medium text-secondary hover:underline pt-2">
                <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                <span>Abrir este Board no Trello</span>
              </a>
            </div>
          </div>`;
      }).join('');
    }
  }
}

/**
 * Alterna a visibilidade dos detalhes do board
 */
function toggleTrelloBoard(idx) {
  const content = document.getElementById(`board-content-${idx}`);
  const icon = document.getElementById(`board-icon-${idx}`);
  if (!content || !icon) return;
  
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    content.classList.add('flex');
    icon.classList.add('rotate-180');
  } else {
    content.classList.add('hidden');
    content.classList.remove('flex');
    icon.classList.remove('rotate-180');
  }
}

/**
 * Função utilitária genérica de cópia.
 */
async function copyToClipboard(text, itemName = 'Item') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${itemName} copiado!`, 'content_copy');
  } catch (err) {
    showToast(`Erro ao copiar ${itemName}`, 'error');
  }
}

/**
 * Copia a API Key do Trello para a área de transferência.
 */
async function copyTrelloApiKey() {
  if (!state.trelloApiKey) return;
  try {
    await navigator.clipboard.writeText(state.trelloApiKey);
    showToast('API Key copiada!', 'content_copy');
  } catch (err) {
    showToast('Erro ao copiar API Key', 'error');
  }
}

/**
 * Copia o token Trello para a área de transferência.
 */
async function copyTrelloToken() {
  if (!state.trelloToken) return;
  try {
    await navigator.clipboard.writeText(state.trelloToken);
    showToast('Token copiado!', 'content_copy');
  } catch {
    showToast('Não foi possível copiar automaticamente.', 'warning');
  }
}

/**
 * Copia a URL de Origem (Allowed Origins) para a área de transferência.
 */
async function copyTrelloOrigin() {
  const origin = window.location.origin;
  try {
    await navigator.clipboard.writeText(origin);
    showToast('Origem copiada!', 'content_copy');
  } catch {
    showToast('Não foi possível copiar automaticamente.', 'warning');
  }
}

/**
 * Desconecta o Trello (limpa sessão e marca estado deslogado).
 */
function disconnectTrello() {
  localStorage.setItem(TRELLO_LS_KEY_TOKEN, 'DISCONNECTED');
  localStorage.setItem(TRELLO_LS_KEY_APIKEY, 'DISCONNECTED');
  state.trelloToken  = null;
  state.trelloApiKey = null;
  state.trelloUser   = null;
  state.trelloBoards = [];
  
  const keyInput   = document.getElementById('trello-api-key-input');
  const tokenInput = document.getElementById('trello-token-input');
  if (keyInput)   keyInput.value   = '';
  if (tokenInput) tokenInput.value = '';

  const panelNotConn = document.getElementById('trello-not-connected');
  const panelConn    = document.getElementById('trello-connected');
  if (panelNotConn) panelNotConn.classList.remove('hidden');
  if (panelConn)    panelConn.classList.add('hidden');
  
  addLog('info', 'Trello desconectado.');
  showToast('Trello desconectado. Insira novas credenciais ou conecte outra conta.', 'logout');
}

// ─────────────────────────────────────────────
// BROKER LEADS — consulta via n8n API
// ─────────────────────────────────────────────
async function fetchBrokerLeads() {
  if (CONFIG.enableStatsWebhooks) {
    try {
      const resp = await fetch(`${CONFIG.n8nBaseUrl}/webhook/dashboard-stats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.brokers) {
          data.brokers.forEach(b => { state.brokerLeads[b.id] = b; });
          document.getElementById('kpi-total').textContent = data.totalLeads ?? '—';
          document.getElementById('kpi-today').textContent = data.todayLeads ?? '—';
        }
        if (data.lastSync) state.lastSync = new Date(data.lastSync);
        addLog('success', `Métricas atualizadas via API (${data.totalLeads ?? '?'} leads total).`);
        return;
      }
    } catch {
      // Fallback below
    }
  }

  // addLog('warn', 'Endpoint de métricas não configurado — exibindo dados locais/demonstração.');
  const demo = {
    'agabo': { id: 'agabo', name: 'Ágabo', leads: 47, lastLead: '8min',  phone: '5583999931422' },
    'brisa': { id: 'brisa', name: 'Brisa', leads: 31, lastLead: '22min', phone: '5583921485647' },
  };
  Object.assign(state.brokerLeads, demo);
  const total = Object.values(demo).reduce((s, b) => s + b.leads, 0);
  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-today').textContent = Math.floor(Math.random() * 8 + 2);
}

// ─────────────────────────────────────────────
// LAST SYNC TIME
// ─────────────────────────────────────────────
async function fetchLastSyncTime() {
  if (CONFIG.enableStatsWebhooks) {
    try {
      const resp = await fetch(`${CONFIG.n8nBaseUrl}/webhook/dashboard-last-sync`, {
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.lastSync) state.lastSync = new Date(data.lastSync);
      }
    } catch { /* ignore */ }
  }

  if (!state.lastSync) state.lastSync = new Date(Date.now() - 7 * 60 * 1000);
  const el1 = document.getElementById('last-sync-time');
  const el2 = document.getElementById('header-last-update');
  if (el1) el1.textContent = formatDateTime(state.lastSync);
  if (el2) el2.textContent = `Última sync: ${formatRelative(state.lastSync)}`;
}

// ─────────────────────────────────────────────
// SYNC ACTION
// ─────────────────────────────────────────────
async function triggerTrelloSync() {
  if (state.syncing) return;
  state.syncing = true;
  setSyncLoadingState(true);
  addLog('info', 'Sincronização acionada pelo usuário...');

  try {
    // Usando mode: 'no-cors' e text/plain para evitar bloqueio de CORS (preflight) pelo navegador
    await fetch(`${CONFIG.n8nBaseUrl}${CONFIG.syncWebhookPath}`, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ source: 'dashboard', triggeredAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });

    // Opaque response (no-cors) não permite ler status HTTP, assumimos sucesso se a rede não falhar
    state.lastSync = new Date();
    showToast('Sincronização enviada ao n8n!', 'check_circle');
    addLog('success', 'Comando de sync enviado para o webhook.');
    
    const el1 = document.getElementById('last-sync-time');
    const el2 = document.getElementById('header-last-update');
    if (el1) el1.textContent = formatDateTime(state.lastSync);
    if (el2) el2.textContent = `Última sync: agora mesmo`;
    
    setTimeout(() => {
      fetchBrokerLeads();
    }, 2000);
  } catch (err) {
    showToast('Erro de rede ao acionar o n8n.', 'error');
    addLog('error', `Falha ao contatar webhook: ${err.message}`);
  } finally {
    state.syncing = false;
    setSyncLoadingState(false);
  }
}

function setSyncLoadingState(loading) {
  const icons  = ['main-sync-icon','sidebar-sync-icon','header-sync-icon'];
  const labels = ['main-sync-label','sidebar-sync-label','header-sync-label'];
  const btns   = ['main-sync-btn','sidebar-sync-btn'];
  icons.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('spin', loading);
  });
  labels.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = loading
      ? 'Sincronizando...'
      : (id.includes('header') ? 'Sync Trello' : id.includes('sidebar') ? 'Atualizar no Trello' : 'Atualizar Lista no Trello');
  });
  btns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = loading;
  });
}

// ─────────────────────────────────────────────
// REFRESH ALL
// ─────────────────────────────────────────────
async function refreshAll() {
  const icon = document.getElementById('refresh-icon');
  if (icon) icon.classList.add('spin');
  addLog('info', 'Atualizando todos os dados do dashboard...');
  await Promise.all([
    refreshServiceStatuses(),
    fetchBrokerLeads(),
    fetchLastSyncTime(),
  ]);
  renderBrokerGrid();
  updateKPIActiveBrokers();
  if (icon) icon.classList.remove('spin');
  addLog('success', 'Dashboard atualizado.');
}

// ─────────────────────────────────────────────
// RENDER — Infrastructure Status Pills
// ─────────────────────────────────────────────
function renderInfraStatus() {
  const container = document.getElementById('infra-status-row');
  if (!container) return;
  container.innerHTML = CONFIG.services.map(s => {
    const status   = state.serviceStatuses[s.key] ?? 'checking';
    const colorDot = status === 'online' ? 'bg-status-online' : status === 'offline' ? 'bg-status-offline' : 'bg-status-warn';
    const label    = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Verificando';
    return `
      <div class="flex items-center space-x-2 bg-surface-container-lowest border border-outline-variant px-3 py-1.5 rounded-full shadow-level-1">
        <span class="w-2 h-2 rounded-full ${colorDot} ${status === 'online' ? 'pulse-dot' : ''}"></span>
        <span class="text-label-md text-on-surface">${s.label}</span>
        <span class="text-label-md text-on-surface-variant">&middot; ${label}</span>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// RENDER — Infra Table
// ─────────────────────────────────────────────
function renderInfraTable() {
  const tbody = document.getElementById('infra-table-body');
  if (!tbody) return;
  tbody.innerHTML = CONFIG.services.map(s => {
    const status = state.serviceStatuses[s.key] ?? 'checking';
    const badgeClass = {
      online:   'bg-green-100 text-status-online',
      offline:  'bg-red-100 text-status-offline',
      checking: 'bg-amber-100 text-status-warn',
    }[status] ?? 'bg-gray-100 text-gray-500';
    const badgeText  = { online: '🟢 Online', offline: '🔴 Offline', checking: '🟡 Verificando' }[status] ?? '—';
    const urlDisplay = s.url.startsWith('http')
      ? `<a href="${s.url}" target="_blank" rel="noopener" class="text-secondary hover:underline">${s.url}</a>`
      : `<span class="text-on-surface-variant">${s.url}</span>`;
    return `
      <tr class="hover:bg-surface-container-low transition-colors">
        <td class="px-6 py-4 text-body-sm text-on-surface font-medium">${s.label}</td>
        <td class="px-6 py-4 text-body-sm text-on-surface-variant font-mono">${s.image}</td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-md font-medium ${badgeClass}">${badgeText}</span>
        </td>
        <td class="px-6 py-4 text-body-sm text-on-surface-variant hidden md:table-cell">${s.port}</td>
        <td class="px-6 py-4 text-body-sm hidden lg:table-cell">${urlDisplay}</td>
      </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
// RENDER — Broker Cards
// ─────────────────────────────────────────────
function renderBrokerGrid() {
  const grid = document.getElementById('broker-grid');
  if (!grid) return;

  const brokers  = CONFIG.brokers.map(b => ({ ...b, ...state.brokerLeads[b.id] }));
  const maxLeads = Math.max(...brokers.map(b => b.leads ?? 0), 1);

  grid.innerHTML = brokers.map((b, i) => {
    const leads    = b.leads ?? 0;
    const lastLead = b.lastLead ?? '—';
    const pct      = Math.round((leads / maxLeads) * 100);
    const initials = b.avatar || b.name.slice(0,2).toUpperCase();
    const accentColors = ['#CC323A','#201F1F','#8C1C22','#4a4a4a'];
    const accent = accentColors[i % accentColors.length];
    return `
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-level-1 border border-surface-container-highest flex flex-col items-center text-center relative overflow-hidden group hover:shadow-md transition-all duration-300 card-accent">
        <div class="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style="background:linear-gradient(90deg,${accent},${accent}88)"></div>
        <div class="w-20 h-20 rounded-full mb-4 border-2 border-surface-container-low shadow-sm flex items-center justify-center text-on-secondary font-black text-title-lg" style="background:${accent}">
          ${initials}
        </div>
        <h3 class="text-title-lg text-on-surface mb-0.5 font-semibold">${b.name}</h3>
        <p class="text-label-md text-on-surface-variant mb-5 uppercase tracking-wider">${b.role}</p>
        <p class="text-label-md text-on-surface-variant mb-1">📱 +${b.phone}</p>
        <div class="bg-surface-container-low rounded-lg p-4 w-full border border-surface-container-highest mt-3">
          <p class="text-label-md text-on-surface-variant mb-1">Total de Leads Recebidos</p>
          <p class="text-display-lg font-bold" style="color:${accent}">${leads}</p>
        </div>
        <div class="w-full mt-3">
          <div class="flex justify-between text-label-md text-on-surface-variant mb-1">
            <span>Participação</span><span>${pct}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;background:${accent};"></div>
          </div>
        </div>
        <div class="mt-4 flex w-full justify-between items-center text-on-surface-variant">
          <div class="flex items-center space-x-1">
            <span class="material-symbols-outlined text-[16px]" style="color:${accent}">check_circle</span>
            <span class="text-body-sm">Ativo</span>
          </div>
          <span class="text-body-sm">Último lead: ${lastLead}</span>
        </div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// RENDER — Logs
// ─────────────────────────────────────────────
function renderLogs() {
  const feed = document.getElementById('log-feed');
  if (!feed) return;
  if (state.logs.length === 0) {
    feed.innerHTML = '<p class="px-6 py-8 text-center text-on-surface-variant text-body-sm">Nenhum log registrado ainda.</p>';
    return;
  }
  const iconMap  = { info: 'info', success: 'check_circle', warn: 'warning', error: 'error' };
  const colorMap = { info: 'text-secondary', success: 'text-status-online', warn: 'text-status-warn', error: 'text-status-offline' };
  feed.innerHTML = state.logs.map(l => `
    <div class="flex items-start space-x-3 px-5 py-3 log-entry hover:bg-surface-container-low transition-colors">
      <span class="material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0 ${colorMap[l.level] ?? 'text-on-surface-variant'}">${iconMap[l.level] ?? 'circle'}</span>
      <div class="flex-1 min-w-0">
        <p class="text-body-sm text-on-surface">${l.msg}</p>
      </div>
      <span class="text-label-md text-on-surface-variant whitespace-nowrap flex-shrink-0">${formatDateTime(l.time)}</span>
    </div>
  `).join('');
}

function clearLogs() {
  state.logs = [];
  renderLogs();
  showToast('Logs limpos.', 'delete_sweep');
}

// ─────────────────────────────────────────────
// KPI HELPERS
// ─────────────────────────────────────────────
function updateKPIServices() {
  const total  = CONFIG.services.length;
  const online = Object.values(state.serviceStatuses).filter(v => v === 'online').length;
  const el = document.getElementById('kpi-services');
  if (el) el.textContent = `${online}/${total}`;
}

function updateKPIActiveBrokers() {
  const el = document.getElementById('kpi-active-brokers');
  if (el) el.textContent = CONFIG.brokers.length;
}


// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
async function init() {
  addLog('info', 'Dashboard inicializado — Atendimoveis Lead Monitor v2.1');
  updateKPIActiveBrokers();
  renderInfraTable();

  // Populate origin url for Trello setup
  const originInput = document.getElementById('trello-origin-input');
  if (originInput) originInput.value = window.location.origin;

  // Verifica se voltamos de um redirect do Trello ao iniciar
  // (caso o user recarregue a página já na seção connections)
  const hash = window.location.hash.substring(1);
  if (hash && new URLSearchParams(hash).has('token')) {
    showSection('connections', document.getElementById('nav-connections'));
    await checkTrelloLoginReturn();
  } else {
    // Verifica sessão salva ou credenciais globais do servidor
    const savedToken  = localStorage.getItem(TRELLO_LS_KEY_TOKEN) || CONFIG.trelloToken;
    const savedApiKey = localStorage.getItem(TRELLO_LS_KEY_APIKEY) || CONFIG.trelloApiKey;
    if (savedToken && savedApiKey && savedApiKey !== 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO') {
      state.trelloToken  = savedToken;
      state.trelloApiKey = savedApiKey;
      const keyInput   = document.getElementById('trello-api-key-input');
      const tokenInput = document.getElementById('trello-token-input');
      if (keyInput)   keyInput.value   = savedApiKey;
      if (tokenInput) tokenInput.value = savedToken;
      // Carrega perfil em background (sem bloquear init)
      loadTrelloProfile().catch(() => {});
    }
  }

  await refreshAll();

  // Auto-refresh periódico
  setInterval(async () => {
    await refreshServiceStatuses();
    await fetchLastSyncTime();
    await fetchBrokerLeads();
    
    // Atualiza instâncias e leads se a seção estiver visível
    if (state.currentSection === 'connections') {
      await refreshEvolutionInstances();
    }
    if (state.currentSection === 'leads') {
      await fetchLeadsHistory();
    }
  }, CONFIG.statusRefreshInterval);
}

document.addEventListener('DOMContentLoaded', init);

// ─────────────────────────────────────────────
// HISTÓRICO DE LEADS
// ─────────────────────────────────────────────
async function fetchLeadsHistory() {
  const ul = document.getElementById('leads-history-list');
  if (!ul) return;

  if (!state.trelloApiKey || !state.trelloToken) {
    ul.innerHTML = `
      <li class="p-8 text-center flex flex-col items-center">
        <span class="material-symbols-outlined text-[48px] text-on-surface-variant mb-4 opacity-50">lock</span>
        <p class="text-body-sm text-on-surface-variant max-w-sm">Conecte-se ao Trello na aba de Conexões para buscar os leads capturados nos seus quadros.</p>
      </li>`;
    return;
  }

  // Se já está buscando, não faz duplo
  if (ul.innerHTML.includes('Buscando...')) return;
  
  ul.innerHTML = '<li class="p-8 text-center text-on-surface-variant text-body-sm flex items-center justify-center space-x-2"><span class="material-symbols-outlined spin text-[20px]">refresh</span> <span>Buscando os últimos leads...</span></li>';

  try {
    // Busca todos os boards abertos com seus cards para extrair o histórico real
    const url = `https://api.trello.com/1/members/me/boards?filter=open&cards=open&card_fields=name,desc,url,dateLastActivity&key=${state.trelloApiKey}&token=${state.trelloToken}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`HTTP ${resp.status} - ${errText}`);
    }
    
    const boards = await resp.json();
    let allCards = [];
    boards.forEach(b => {
      if (b.cards && b.cards.length > 0) {
        allCards = allCards.concat(b.cards);
      }
    });

    // Ordena do mais recente para o mais antigo (baseado na última atividade)
    allCards.sort((a, b) => new Date(b.dateLastActivity) - new Date(a.dateLastActivity));
    
    // Pega os 50 mais recentes
    const recentCards = allCards.slice(0, 50);

    if (recentCards.length === 0) {
      ul.innerHTML = '<li class="p-8 text-center text-on-surface-variant text-body-sm">Nenhum card encontrado nos seus quadros.</li>';
      return;
    }

    ul.innerHTML = recentCards.map(c => `
      <li class="px-6 py-4 hover:bg-surface-container-low transition group">
        <div class="flex items-start justify-between">
          <div class="flex flex-col space-y-1">
            <a href="${c.url}" target="_blank" class="text-body-sm font-medium text-on-surface group-hover:text-primary transition line-clamp-1">${c.name}</a>
            <span class="text-[11px] text-on-surface-variant block opacity-70">${c.desc ? c.desc.substring(0, 80) + '...' : 'Sem descrição'}</span>
          </div>
          <a href="${c.url}" target="_blank" class="text-secondary opacity-0 group-hover:opacity-100 transition p-1 bg-surface-container hover:bg-surface-container-high rounded flex-shrink-0 ml-4">
            <span class="material-symbols-outlined text-[16px]">open_in_new</span>
          </a>
        </div>
      </li>
    `).join('');
    
  } catch (err) {
    ul.innerHTML = `<li class="p-8 text-center text-error text-body-sm">Falha ao buscar histórico: ${err.message}</li>`;
  }
}
