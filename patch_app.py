import re

with open('dashboard/app.js', 'r') as f:
    content = f.read()

# Add n8nApiKey to CONFIG
content = content.replace("trelloApiKey: 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO',", "trelloApiKey: 'COLOQUE_AQUI_A_SUA_API_KEY_DO_TRELLO',\n  n8nApiKey: 'COLOQUE_AQUI_A_SUA_API_KEY_DO_N8N',\n  n8nWorkflowId: 'wl1Dy5KQb0JzyBvf',")

# In loadTrelloProfile, after setting state.trelloBoards, populate the select
populate_select = """
  // Populate board select
  const select = document.getElementById('trello-board-select');
  if (select) {
    select.innerHTML = '<option value="">Selecione um board...</option>' + 
      boards.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
"""
content = content.replace("state.trelloBoards = boards;\n", "state.trelloBoards = boards;\n" + populate_select)

# Add onTrelloBoardSelect, onTrelloListSelect and syncTrelloToN8n functions
new_funcs = """
// ─────────────────────────────────────────────
// TRELLO BOARDS & LISTS
// ─────────────────────────────────────────────

async function onTrelloBoardSelect() {
  const boardId = document.getElementById('trello-board-select')?.value;
  const listSelect = document.getElementById('trello-list-select');
  if (!listSelect) return;
  
  if (!boardId) {
    listSelect.innerHTML = '<option value="">Selecione um board primeiro</option>';
    return;
  }
  
  listSelect.innerHTML = '<option value="">Carregando...</option>';
  try {
    const res = await fetch(getTrelloApiUrl(`/boards/${boardId}/lists`));
    if (!res.ok) throw new Error('Falha ao buscar colunas');
    const lists = await res.json();
    listSelect.innerHTML = '<option value="">Selecione a coluna de Leads...</option>' + 
      lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
  } catch (err) {
    showToast('Erro ao buscar listas do Trello: ' + err.message, 'error');
    listSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

async function syncTrelloToN8n() {
  const boardId = document.getElementById('trello-board-select')?.value;
  const listId = document.getElementById('trello-list-select')?.value;
  
  if (!boardId || !listId) {
    showToast('Por favor, selecione um Board e uma Coluna primeiro.', 'warning');
    return;
  }
  
  if (!CONFIG.n8nApiKey || CONFIG.n8nApiKey === 'COLOQUE_AQUI_A_SUA_API_KEY_DO_N8N') {
    showToast('Erro: n8nApiKey não configurada no app.js!', 'error');
    return;
  }

  const btn = document.getElementById('btn-sync-n8n');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined spin text-[18px]">sync</span> Sincronizando...';
  btn.disabled = true;

  try {
    const headers = {
      'X-N8N-API-KEY': CONFIG.n8nApiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    // 1. Busca o Workflow atual
    const resGet = await fetch(`${CONFIG.n8nBaseUrl}/api/v1/workflows/${CONFIG.n8nWorkflowId}`, { headers });
    if (!resGet.ok) throw new Error('Erro ao buscar workflow no n8n. Verifique a N8N_API_KEY ou problema de CORS.');
    const wf = await resGet.json();
    
    // 2. Modifica os nós necessários
    let modified = false;
    for (const node of wf.nodes) {
      if (node.type === 'n8n-nodes-base.trelloTrigger') {
        node.parameters.id = boardId;
        modified = true;
      }
      if (node.type === 'n8n-nodes-base.trello' && node.name === 'Criar Card no Trello (Leads)') {
        node.parameters.listId = listId;
        modified = true;
      }
    }
    
    if (!modified) {
      throw new Error('Nenhum nó Trello compatível encontrado no workflow.');
    }
    
    // 3. Salva de volta no n8n
    const resPut = await fetch(`${CONFIG.n8nBaseUrl}/api/v1/workflows/${CONFIG.n8nWorkflowId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(wf)
    });
    
    if (!resPut.ok) throw new Error('Erro ao salvar workflow no n8n.');
    
    showToast('Workflow do n8n atualizado com sucesso!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Falha ao sincronizar: ' + err.message, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}
"""

content = content.replace("// ─────────────────────────────────────────────\n// INIT", new_funcs + "\n// ─────────────────────────────────────────────\n// INIT")

with open('dashboard/app.js', 'w') as f:
    f.write(content)
print("Patched app.js")
