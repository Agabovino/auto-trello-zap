import json

with open('🔐 Meta Webhook Verification (GET).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

json_body_agabo = "={{\n  const rawName = $json.action?.data?.card?.name || '';\n  const phoneMatch = rawName.match(/\\d{10,13}/);\n  const phone = phoneMatch ? phoneMatch[0] : '';\n  let name = rawName.replace(/\\(\\d{10,13}\\)/, '').replace(/Lead \\d{10,13}/, '').replace(/\\d{10,13}/, '').trim();\n  const leadDisplay = phone ? (name && name.toLowerCase() !== 'lead' ? `${name} https://wa.me/${phone}` : `https://wa.me/${phone}`) : rawName;\n  return JSON.stringify({\n    number: '5583999931422',\n    text: `Olá! O lead ${leadDisplay} foi adicionado à sua coluna!`\n  });\n}}"

json_body_brisa = "={{\n  const rawName = $json.action?.data?.card?.name || '';\n  const phoneMatch = rawName.match(/\\d{10,13}/);\n  const phone = phoneMatch ? phoneMatch[0] : '';\n  let name = rawName.replace(/\\(\\d{10,13}\\)/, '').replace(/Lead \\d{10,13}/, '').replace(/\\d{10,13}/, '').trim();\n  const leadDisplay = phone ? (name && name.toLowerCase() !== 'lead' ? `${name} https://wa.me/${phone}` : `https://wa.me/${phone}`) : rawName;\n  return JSON.stringify({\n    number: '5583921485647',\n    text: `Olá! O lead ${leadDisplay} foi adicionado à sua coluna!`\n  });\n}}"

for n in wf['nodes']:
    if n.get('name') == 'Confirmar via WhatsApp':
        n['parameters']['jsonBody'] = json_body_agabo
    elif n.get('name') == 'Confirmar via WhatsApp2':
        n['parameters']['jsonBody'] = json_body_brisa

with open('🔐 Meta Webhook Verification (GET).json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Updated notification messages in 🔐 Meta Webhook Verification (GET).json successfully!")
