import json

with open('🔐 Meta Webhook Verification (GET).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for n in wf['nodes']:
    if n.get('name') == 'Trello Trigger':
        n['type'] = 'n8n-nodes-base.webhook'
        n['typeVersion'] = 1
        n['parameters'] = {
            'httpMethod': 'POST',
            'path': 'trello-webhook',
            'options': {}
        }

with open('🔐 Meta Webhook Verification (GET).json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Converted Trello Trigger to Webhook node successfully!")
