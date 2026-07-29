import json
import sqlite3

# 1. Carregar o workflow preservando todas as modificações do usuário
with open('🔐 Meta Webhook Verification (GET).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# 2. Atualizar o jsonBody em todos os nós HTTP Request de confirmação no WhatsApp
for n in wf['nodes']:
    if n.get('type') == 'n8n-nodes-base.httpRequest' and 'message/sendText' in n.get('parameters', {}).get('url', ''):
        params = n['parameters']
        
        # Extrai o número do destinatário existente no nó
        current_body = params.get('jsonBody', '')
        num = '5583999931422'
        if '5583921485647' in current_body:
            num = '5583921485647'
        elif '5583999931422' in current_body:
            num = '5583999931422'
            
        # IIFE válida para a sintaxe do n8n
        new_json_body = f"""={{{{
  (() => {{
    const rawName = $json.action?.data?.card?.name || '';
    const phoneMatch = rawName.match(/\\d{{10,13}}/);
    const phone = phoneMatch ? phoneMatch[0] : '';
    let name = rawName.replace(/\\(\\d{{10,13}}\\)/, '').replace(/Lead \\d{{10,13}}/, '').replace(/\\d{{10,13}}/, '').trim();
    const leadDisplay = phone ? (name && name.toLowerCase() !== 'lead' ? `${{name}} https://wa.me/${{phone}}` : `https://wa.me/${{phone}}`) : rawName;
    return {{
      number: "{num}",
      text: `Olá! O lead ${{leadDisplay}} foi adicionado à sua coluna!`
    }};
  }})()
}}}}"""
        params['jsonBody'] = new_json_body

# Salvar o workflow atualizado mantendo todos os corretores criados pelo usuário
with open('🔐 Meta Webhook Verification (GET).json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Preserved all user broker nodes and fixed jsonBody IIFE syntax successfully!")

# 3. Atualizar o banco do n8n com as alterações do usuário + sintaxe corrigida
conn = sqlite3.connect('/tmp/current_user_db.sqlite')
c = conn.cursor()

c.execute('UPDATE workflow_entity SET nodes = ?, connections = ? WHERE id = "wl1Dy5KQb0JzyBvf"', (json.dumps(wf['nodes']), json.dumps(wf['connections'])))

conn.commit()
conn.close()

print("Updated SQLite database with user changes + IIFE fix!")
