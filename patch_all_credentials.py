import json

def patch_workflow(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        wf = json.load(f)
    
    for n in wf['nodes']:
        # Se o nó tiver credenciais apontando para trelloApi / WGhjY0TBSOX8LgMk
        if 'credentials' in n and 'trelloApi' in n['credentials']:
            del n['credentials']['trelloApi']
            if not n['credentials']:
                del n['credentials']
        
        if n.get('type') == 'n8n-nodes-base.httpRequest':
            # Garantir que a URL do Trello use key e token da env
            url = n.get('parameters', {}).get('url', '')
            if 'api.trello.com' in url:
                params = n.get('parameters', {})
                params['sendQuery'] = True
                qp = params.get('queryParameters', {}).get('parameters', [])
                
                # Adicionar key e token se não existirem
                has_key = any(p.get('name') == 'key' for p in qp)
                has_token = any(p.get('name') == 'token' for p in qp)
                
                if not has_key:
                    qp.append({'name': 'key', 'value': '={{ $env.TRELLO_API_KEY }}'})
                if not has_token:
                    qp.append({'name': 'token', 'value': '={{ $env.TRELLO_TOKEN }}'})
                
                params['queryParameters'] = {'parameters': qp}

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)

patch_workflow('🔐 Meta Webhook Verification (GET).json')
patch_workflow('workflow-import-historical-contacts.json')
patch_workflow('workflow-whatsapp-lead-auto.json')

print("Patched all workflow credentials successfully!")
