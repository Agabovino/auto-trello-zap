import json
import os
import urllib.request
import urllib.parse
import time

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

env = load_env()
key = os.environ.get('TRELLO_API_KEY') or env.get('TRELLO_API_KEY', '')
token = os.environ.get('TRELLO_TOKEN') or env.get('TRELLO_TOKEN', '')
board_id = os.environ.get('TRELLO_BOARD_ID') or env.get('TRELLO_BOARD_ID', '')
list_id = os.environ.get('TRELLO_LIST_ID') or env.get('TRELLO_LIST_ID', '')
evo_instance = os.environ.get('EVOLUTION_INSTANCE') or env.get('EVOLUTION_INSTANCE', 'atendimoveis_meta')
evo_key = os.environ.get('EVOLUTION_API_KEY') or env.get('EVOLUTION_API_KEY', 'evo-zap-agabo-2026')

def run_import():
    print(f"Starting background import of all contacts for {evo_instance}...")
    
    # 1. Fetch Trello Cards
    url_cards = f'https://api.trello.com/1/boards/{board_id}/cards?filter=open&fields=name,desc&key={key}&token={token}'
    req_trello = urllib.request.urlopen(url_cards)
    trello_cards = json.loads(req_trello.read().decode())
    existing_texts = [(c.get('name', '') + ' ' + c.get('desc', '')).lower() for c in trello_cards]
    print(f"Loaded {len(trello_cards)} existing cards from Trello.")

    # 2. Fetch Evolution Contacts for instance
    url_contacts = f'http://localhost:8081/chat/findContacts/{evo_instance}'
    req_contacts = urllib.request.Request(
        url_contacts,
        data=b'{}',
        headers={'Content-Type': 'application/json', 'apikey': evo_key}
    )
    contacts = json.loads(urllib.request.urlopen(req_contacts).read().decode())
    print(f"Loaded {len(contacts)} contacts from Evolution API ({evo_instance}).")

    to_create = []
    seen = set()
    for c in contacts:
        jid = c.get('remoteJid', '')
        if not jid or jid.endswith('@g.us') or c.get('isGroup'):
            continue
        phone = jid.split('@')[0] if ('@s.whatsapp.net' in jid or '@c.us' in jid) else ''
        if not phone or len(phone) < 10 or phone in seen:
            continue
        seen.add(phone)

        if not any(phone in text for text in existing_texts):
            push_name = (c.get('pushName') or c.get('profileName') or c.get('name') or '').strip()
            display_name = push_name if (push_name and push_name != 'None') else 'Desconhecido'
            to_create.append({'phone': phone, 'name': display_name})

    total_eligible = len(to_create)
    print(f"Total eligible new leads to import: {total_eligible}")

    created_count = 0
    for idx, item in enumerate(to_create, start=1):
        phone = item['phone']
        name = item['name']
        title = f'{name} ({phone})' if name != 'Desconhecido' else f'Lead {phone}'
        desc = f'📲 Lead importado historicamente via WhatsApp\nFonte: Evolution API ({evo_instance})\n\nNome: {name}\nNúmero: {phone}'

        post_url = 'https://api.trello.com/1/cards'
        params = urllib.parse.urlencode({
            'idList': list_id,
            'name': title,
            'desc': desc,
            'pos': 'bottom',
            'key': key,
            'token': token
        }).encode('utf-8')

        success = False
        for attempt in range(5):
            try:
                req = urllib.request.Request(post_url, data=params, method='POST')
                urllib.request.urlopen(req)
                created_count += 1
                success = True
                break
            except Exception as e:
                print(f"Attempt {attempt+1} failed for {phone}: {e}")
                time.sleep(3)

        if created_count % 50 == 0:
            print(f"Progress: {created_count}/{total_eligible} cards created in Trello.")
        
        time.sleep(0.3)

    print(f"Finished! Successfully created {created_count} cards out of {total_eligible}.")

if __name__ == '__main__':
    run_import()
