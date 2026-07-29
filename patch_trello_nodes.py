import json
import os

# Node HTTP Request substituto para criação de card no Trello (sem dependência de credencial salva)
trello_create_node_lead = {
  "parameters": {
    "method": "POST",
    "url": "https://api.trello.com/1/cards",
    "sendQuery": True,
    "queryParameters": {
      "parameters": [
        {
          "name": "idList",
          "value": "={{ $env.TRELLO_LIST_ID || '6a68e0681ad8093e17b2fb61' }}"
        },
        {
          "name": "name",
          "value": "={{ $json.cardTitle }}"
        },
        {
          "name": "desc",
          "value": "={{ $json.cardDescription }}"
        },
        {
          "name": "pos",
          "value": "top"
        },
        {
          "name": "key",
          "value": "={{ $env.TRELLO_API_KEY }}"
        },
        {
          "name": "token",
          "value": "={{ $env.TRELLO_TOKEN }}"
        }
      ]
    },
    "options": {}
  },
  "id": "node-trello-create",
  "name": "Criar Card no Trello (Leads)",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [720, 300]
}

# 1. Atualizar workflow-whatsapp-lead-auto.json
with open('workflow-whatsapp-lead-auto.json', 'r', encoding='utf-8') as f:
    lead_wf = json.load(f)

for i, n in enumerate(lead_wf['nodes']):
    if n.get('name') == 'Criar Card no Trello (Leads)':
        lead_wf['nodes'][i] = trello_create_node_lead

with open('workflow-whatsapp-lead-auto.json', 'w', encoding='utf-8') as f:
    json.dump(lead_wf, f, indent=2, ensure_ascii=False)

print("Updated workflow-whatsapp-lead-auto.json successfully!")

# 2. Atualizar 🔐 Meta Webhook Verification (GET).json
with open('🔐 Meta Webhook Verification (GET).json', 'r', encoding='utf-8') as f:
    meta_wf = json.load(f)

trello_create_node_meta = dict(trello_create_node_lead)
trello_create_node_meta['id'] = "226992f4-a6f6-4828-a059-a7b8eb70a615"
trello_create_node_meta['position'] = [784, -64]

for i, n in enumerate(meta_wf['nodes']):
    if n.get('name') == 'Criar Card no Trello (Leads)':
        meta_wf['nodes'][i] = trello_create_node_meta

with open('🔐 Meta Webhook Verification (GET).json', 'w', encoding='utf-8') as f:
    json.dump(meta_wf, f, indent=2, ensure_ascii=False)

print("Updated 🔐 Meta Webhook Verification (GET).json successfully!")
