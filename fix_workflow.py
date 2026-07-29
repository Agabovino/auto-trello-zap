import json
import sqlite3

# 1. Corrigir 🔐 Meta Webhook Verification (GET).json
with open('🔐 Meta Webhook Verification (GET).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# Remover o nó 'Adicionar allowedInstance'
wf['nodes'] = [n for n in wf['nodes'] if n.get('name') != 'Adicionar allowedInstance']

# Conectar 'Webhook Lead Entrada' diretamente em 'Parsear Mensagem de Lead'
wf['connections']['Webhook Lead Entrada'] = {
    'main': [
        [
            {
                'node': 'Parsear Mensagem de Lead',
                'type': 'main',
                'index': 0
            }
        ]
    ]
}

if 'Adicionar allowedInstance' in wf['connections']:
    del wf['connections']['Adicionar allowedInstance']

code_content = """// ═══════════════════════════════════════════════════════
// PARSING: Evolution API (Baileys) + Meta Cloud API
// ═══════════════════════════════════════════════════════

const body = $input.item.json.body || $input.item.json;

let senderPhone = '';
let senderName  = 'Desconhecido';
let instanceName = '';
let shouldProcess = false;

// ── Instância permitida (vazia = qualquer uma) ──
const allowedInstance = (process.env.EVOLUTION_INSTANCE || $env.EVOLUTION_INSTANCE || '').trim();

// ── Detectar formato ──
const isEvolution = !!(body?.event || body?.data?.key);
const isMeta      = !!(body?.object === 'whatsapp_business_account' || body?.entry);

if (isEvolution) {
  const event = body?.event || '';

  // Só processar eventos de mensagens recebidas
  if (event && event !== 'messages.upsert') {
    return [{ json: { shouldProcess: false, skipReason: `Evolution: evento ignorado (${event})` } }];
  }

  const data = body?.data || {};

  // Ignorar mensagens enviadas pelo próprio número
  if (data?.key?.fromMe === true) {
    return [{ json: { shouldProcess: false, skipReason: 'Evolution: fromMe=true, mensagem nossa' } }];
  }

  // Ignorar grupos
  const remoteJid = data?.key?.remoteJid || '';
  if (remoteJid.endsWith('@g.us')) {
    return [{ json: { shouldProcess: false, skipReason: 'Evolution: mensagem de grupo ignorada' } }];
  }

  // Ignorar se não tem JID de contato individual
  if (!remoteJid.includes('@s.whatsapp.net') && !remoteJid.includes('@c.us')) {
    return [{ json: { shouldProcess: false, skipReason: 'Evolution: JID não reconhecido' } }];
  }

  // ── Filtro por instância ──
  instanceName = body?.instance || data?.instanceName || body?.instanceName || '';
  if (allowedInstance && instanceName && instanceName !== allowedInstance) {
    return [{ json: { shouldProcess: false, skipReason: `Evolution: instância ignorada (${instanceName} != ${allowedInstance})` } }];
  }

  senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  senderName  = data?.pushName || body?.pushName || '';
  shouldProcess = true;

} else if (isMeta) {
  const entry   = body?.entry?.[0];
  const change  = entry?.changes?.[0];
  const value   = change?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return [{ json: { shouldProcess: false, skipReason: 'Meta: callback sem messages[]' } }];
  }

  senderPhone = message.from || '';
  const contact = value?.contacts?.[0];
  senderName  = contact?.profile?.name || '';
  shouldProcess = true;

} else {
  return [{ json: { shouldProcess: false, skipReason: 'Formato não reconhecido', preview: JSON.stringify(body).substring(0, 200) } }];
}

if (!senderPhone) {
  return [{ json: { shouldProcess: false, skipReason: 'Número do remetente não identificado' } }];
}

// ── Montar dados do card ──
const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const source = isEvolution ? `Evolution API${instanceName ? ` (${instanceName})` : ''}` : 'Meta Cloud API';

const displayName = (senderName && senderName.trim() !== '') ? senderName.trim() : null;
const cardTitle = displayName ? `${displayName} (${senderPhone})` : `Lead ${senderPhone}`;

const cardDescription =
  `📲 Lead capturado automaticamente via WhatsApp\\n` +
  `Fonte: ${source}\\n\\n` +
  (displayName ? `Nome: ${displayName}\\n` : `Nome: (desconhecido)\\n`) +
  `Número: ${senderPhone}\\n` +
  `Data/Hora: ${now}`;

return [{
  json: {
    shouldProcess,
    senderPhone,
    senderName: displayName || '',
    cardTitle,
    cardDescription,
    instanceName,
    timestamp: now
  }
}];"""

for n in wf['nodes']:
    if n.get('name') == 'Parsear Mensagem de Lead':
        n['parameters']['jsCode'] = code_content

with open('🔐 Meta Webhook Verification (GET).json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Updated 🔐 Meta Webhook Verification (GET).json cleanly")

# 2. Atualizar o banco SQLite do n8n
conn = sqlite3.connect('/tmp/clean_stopped.sqlite')
c = conn.cursor()

c.execute('UPDATE workflow_entity SET nodes = ?, connections = ?, active = 1 WHERE id = "wl1Dy5KQb0JzyBvf"', (json.dumps(wf['nodes']), json.dumps(wf['connections'])))

with open('workflow-whatsapp-lead-auto.json', 'r', encoding='utf-8') as f:
    lead_wf = json.load(f)
c.execute('UPDATE workflow_entity SET nodes = ?, connections = ?, active = 1 WHERE id = "RnYYAqQH63LFOtvU"', (json.dumps(lead_wf['nodes']), json.dumps(lead_wf['connections'])))

with open('workflow-import-historical-contacts.json', 'r', encoding='utf-8') as f:
    hist_wf = json.load(f)
c.execute('UPDATE workflow_entity SET nodes = ?, connections = ?, active = 1 WHERE id = "EB8XS9NWHk4UqeL3"', (json.dumps(hist_wf['nodes']), json.dumps(hist_wf['connections'])))

conn.commit()
conn.close()
print("Updated n8n SQLite DB successfully!")
