# Tutorial: Automação Trello <-> WhatsApp com n8n

Este guia fornece instruções passo a passo para configurar um ambiente dockerizado do n8n e implementar fluxos de automação bidirecionais entre o Trello e o WhatsApp.

---

## 1. Configuração do Ambiente Docker

### Pré-requisitos
- Docker e Docker Compose instalados.
- Um domínio ou túnel (Cloudflare Tunnel) para receber webhooks.

### Instalação
1. Clone este repositório ou copie os arquivos `docker-compose.yml` e `.env.example`.
2. Renomeie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edite o `.env` e preencha:
   - `WEBHOOK_URL`: URL pública do n8n (ex: `https://n8n.vivercatolico.com.br/`)
   - `N8N_ENCRYPTION_KEY`: chave aleatória gerada por você
   - `TUNNEL_TOKEN`: token do seu tunnel gerenciado no Cloudflare Zero Trust
4. Suba os contêineres:
   ```bash
   docker compose up -d
   ```
5. Acesse o n8n em `http://localhost:5678`.

---

## 2. Configuração de Credenciais

### Trello

1. Acesse [Trello Power-Ups Admin](https://trello.com/power-ups/admin).
2. Crie um novo Power-Up para obter sua **API Key**.
3. Gere um **Token** de acesso clicando no link de autorização na mesma página.
4. No n8n, crie uma credencial do tipo **Trello API** com a Key e o Token.

> **Credencial já configurada neste projeto (n8n ID):** `WGhjY0TBSOX8LgMk`

### Obter o ID de uma Lista do Trello

Para qualquer nó Trello que exija um `listId` (ex: coluna "Leads"):

1. Abra o board no Trello no navegador.
2. Adicione `.json` ao final da URL do board:
   ```
   https://trello.com/b/SEU_BOARD_ID/nome-do-board.json
   ```
3. Use `Ctrl+F` para buscar pelo nome da lista (ex: `"Leads"`).
4. Copie o valor do campo `"id"` da lista encontrada.
5. Cole esse valor no campo `listId` do nó Trello no n8n.

> **IDs já configurados neste projeto:**
> - Board ID: `6a1494722dc95789afdde69b`
> - Lista **Leads**: substituir `SEU_LIST_ID_LEADS_AQUI` no workflow `workflow-lead-capture.json`

---

### WhatsApp Cloud API (Meta Developers — Oficial)

#### 1. Criar o Aplicativo no Meta for Developers
1. Acesse [Meta for Developers](https://developers.facebook.com/) e faça login.
2. Clique em **Meus Aplicativos** > **Criar Aplicativo**.
3. Selecione tipo **Outro** > **Empresa**.
4. Dê um nome (ex: `n8n-automation`) e clique em **Criar Aplicativo**.

#### 2. Configurar o Produto WhatsApp
1. No painel do aplicativo, clique em **Configurar** ao lado de **WhatsApp**.
2. Selecione ou crie uma **Conta de Negócios do Meta (WABA)** e clique em **Continuar**.

#### 3. Obter Credenciais
1. Vá em **WhatsApp** > **Configuração de API** no menu lateral.
2. Aqui você encontrará:
   - **Token de acesso temporário** (válido por 24h — para testes)
   - **Phone Number ID:** `1138197429373798` *(já configurado nos workflows)*
   - **Número de Teste:** `+1 555 634-2089` (ou formato raw: `15556342089`)
   - **WABA ID**

> ⚠️ **O token expira em 24h.** Quando isso ocorrer, gere um novo token no Console do Meta e substitua o valor `Bearer EAASbk...` nos seguintes nós:
> - `workflow-completo.json` → nós `WhatsApp Notify agabo` e `WhatsApp Notify Sam`
> - `workflow-lead-capture.json` → nó `Confirmar via WhatsApp`

#### 4. Configurar Webhooks (recebimento de mensagens)
1. Vá em **WhatsApp** > **Configuração** > **Webhook** > **Editar**.
2. Configure os endpoints abaixo conforme o workflow desejado:

| Webhook URL | Finalidade |
|---|---|
| `https://n8n.vivercatolico.com.br/webhook/whatsapp-to-trello` | Mensagens genéricas → Trello |
| `https://n8n.vivercatolico.com.br/webhook/lead-capture` | Mensagens de lead → coluna Leads |

3. Defina um **Token de verificação** (ex: `teste`) — use exatamente o mesmo valor no workflow `workflow-meta-verify.json`.
4. Clique em **Gerenciar** e assine o campo `messages`.

#### ⚠️ Erro #1004 — Validação GET da Meta (solução obrigatória)

A Meta valida o webhook com uma requisição **GET** antes de aceitar o endpoint. O n8n em modo de produção só aceita **POST**, o que causa o erro `#1004 - Could not validate callback URL`.

**Por que acontece:** A Meta envia `GET /webhook/lead-capture?hub.mode=subscribe&hub.verify_token=teste&hub.challenge=XXXXXXX` e exige que o servidor responda `200 OK` com o valor exato de `hub.challenge` em `text/plain`. O workflow de `POST` nunca responde a isso.

**Solução — processo em 3 etapas:**

**Etapa 1:** Importe e **ative** o workflow `workflow-meta-verify.json` no n8n.
- Ele cria um endpoint `GET /webhook/lead-capture` dedicado à validação.
- Verifique que o campo `EXPECTED_TOKEN` no nó Code bate com o token cadastrado no painel da Meta (`teste`).

**Etapa 2:** No painel da Meta, clique em **Verificar** (ou Salvar).
- A Meta enviará um `GET` com `hub.challenge`.
- O workflow capturará o challenge, validará o token e responderá `200 OK` com o challenge em `text/plain`.
- A Meta confirmará a URL e o status mudará para "Verificado ✅".

**Etapa 3:** Após validação bem-sucedida, **desative** o `workflow-meta-verify.json`.
- O workflow de produção `workflow-lead-capture.json` (POST) assumirá o processamento real dos leads.

**Teste manual da validação (cURL):**
```bash
curl -X GET "https://n8n.vivercatolico.com.br/webhook/lead-capture?hub.mode=subscribe&hub.verify_token=teste&hub.challenge=3819727"
# Resposta esperada: 3819727
```

#### 5. Configurar Credencial no n8n
- **Access Token:** token gerado no passo 3
- **Phone Number ID:** `1138197429373798`
- **WhatsApp Business Account ID:** WABA ID obtido no passo 3

### WhatsApp (Evolution API — Recomendada para testes com número real)

A Evolution API é a forma mais rápida de receber mensagens reais no n8n sem precisar de aprovação de número de produção na Meta. Funciona com **qualquer número WhatsApp** via QR Code.

#### Como funciona
```
Alguém envia mensagem ao seu número WhatsApp
    ↓
Evolution API intercepta (número conectado via QR)
    ↓
POST automático → http://n8n:5678/webhook/lead-capture
    ↓
n8n processa → cria card no Trello
```

#### 1. Subir o container

A Evolution API já está configurada no `docker-compose.yml`. Antes de subir, edite o `.env`:

```bash
# Defina uma chave de API segura (qualquer string aleatória)
EVOLUTION_API_KEY=minha-chave-super-secreta-123
```

Depois suba o ambiente:
```bash
docker compose up -d
```

Verifique se subiu:
```bash
curl http://localhost:8080
# Deve retornar: {"status":"online"}
```

#### 2. Criar uma instância e conectar via QR Code

```bash
# 1. Criar instância
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_EVOLUTION_API_KEY" \
  -d '{"instanceName": "meu-numero", "qrcode": true}'

# 2. Obter QR Code (formato base64 para escanear)
curl http://localhost:8080/instance/connect/meu-numero \
  -H "apikey: SUA_EVOLUTION_API_KEY"
```

Abra o WhatsApp no celular → **Aparelhos conectados** → **Conectar aparelho** → Escaneie o QR Code retornado.

#### 3. Verificar conexão

```bash
curl http://localhost:8080/instance/fetchInstances \
  -H "apikey: SUA_EVOLUTION_API_KEY"
# Deve mostrar "state": "open"
```

#### 4. O webhook já está configurado

O `docker-compose.yml` já aponta o webhook global da Evolution API para:
```
http://n8n:5678/webhook/lead-capture
```

Isso significa que qualquer mensagem recebida no número conectado será automaticamente enviada ao n8n. **Nenhuma configuração extra necessária.**

#### 5. Testar

Peça para alguém enviar uma mensagem no formato:
```
Lead: Nome Completo | 83 9 9999-0000
```
Para o número que você conectou via QR Code. Verifique as execuções no n8n — deve aparecer uma execução e um card ser criado no Trello.

> **Nota:** A Evolution API usa um formato de payload diferente da Meta Cloud API (`body.data.message.conversation`). O nó **"Parsear Mensagem de Lead"** do `workflow-lead-capture.json` já suporta os dois formatos automaticamente via fallback.

---


## 3. Fluxos de Automação

### Fluxo 1 — Captura de Leads (WhatsApp → Trello / coluna Leads)
**Arquivo:** `workflow-lead-capture.json`
**Endpoint:** `POST https://n8n.vivercatolico.com.br/webhook/lead-capture`

**Objetivo:** Detectar mensagens com nome e telefone de um lead e criar automaticamente um card na coluna **Leads** do Trello.

**Formatos de mensagem aceitos:**
```
Lead: João Silva | 83 9 9999-0000
João Silva - 83999990000
Nome: João Silva | Tel: 83 9 9999-0000
João Silva
83999990000
```

**Estrutura do Workflow (6 nós):**
1. **Webhook** — recebe `POST /webhook/lead-capture`
2. **Code: Parsear Mensagem de Lead** — extrai nome e telefone com regex; suporta Meta Cloud API e Evolution API
3. **Filter: É um Lead?** — só avança se houver telefone válido
4. **Trello: Criar Card** — cria no topo da lista "Leads" com nome, telefone, data e mensagem original
5. **Code: Preparar Confirmação** — monta mensagem de retorno
6. **HTTP Request: Confirmar via WhatsApp** — envia confirmação para o operador

**⚠️ Configuração obrigatória:**
- Substituir `SEU_LIST_ID_LEADS_AQUI` pelo ID real da lista "Leads" no nó Trello (ver seção anterior).

---

### Fluxo 2 — Notificações Trello → WhatsApp (Corretores)
**Arquivo:** `workflow-completo.json` (parte inferior)
**Objetivo:** Notificar Ágabo ou Samara via WhatsApp ao mover um card para a coluna com o nome do corretor.

**Estrutura do Workflow (7 nós):**
1. **Trello Trigger** — dispara ao mover qualquer card no board `6a1494722dc95789afdde69b`
2. **Filter: É movimento de lista?** — garante que é um movimento entre listas
3. **Trello: Obter Detalhes do Card** — busca dados completos
4. **Code: Extrair Variáveis** — extrai nome, responsável, telefone e URL do card
5. **Switch: Quem é o Corretor?** — roteia pelo nome da lista de destino:
   - Saída 0 → `"Corretor Ágabo"` → `5583999931422`
   - Saída 1 → `"Corretora Samara"` → `5583993685452`
6. **HTTP Request: WhatsApp Notify agabo**
7. **HTTP Request: WhatsApp Notify Sam**

> **Pré-requisito:** O template `lead_atribuido_corretor` (idioma `pt_BR`) deve estar aprovado na conta Meta/WhatsApp Business.

---

### Fluxo 3 — Mensagens Genéricas (WhatsApp → Trello)
**Arquivo:** `workflow-completo.json` (parte superior)
**Endpoint:** `POST https://n8n.vivercatolico.com.br/webhook/whatsapp-to-trello`

Cria um card genérico no Trello para qualquer mensagem recebida, sem parsing.

---

## 4. Testando os Workflows

### ⚠️ Problema Comum: `webhook-test/` vs `webhook/` — a diferença crítica

O n8n expõe **dois endpoints diferentes** para cada webhook:

| URL | Modo | Quando funciona |
|---|---|---|
| `.../webhook-test/lead-capture` | **Teste** | Só responde enquanto você está com o workflow aberto no editor e clicou em "Listen for test event" |
| `.../webhook/lead-capture` | **Produção** | Só responde quando o workflow está **Ativo** (toggle ligado no n8n) |

**Se o cURL só funciona com `webhook-test/`** significa que o workflow **não está ativado** em produção. A Meta envia para `webhook/` (produção) e não recebe resposta, logo a mensagem é entregue mas o n8n não processa.

**Solução:** Após importar o workflow, clique no **toggle** no canto superior direito do n8n para ativar (`Active`). O arquivo `workflow-lead-capture.json` já vem com `"active": true`.

---

### Teste do Fluxo de Captura de Leads (cURL — payload real da Meta)

O payload que a Meta envia de verdade tem a estrutura `"object": "whatsapp_business_account"`. Teste com o formato correto:

```bash
curl -X POST https://n8n.vivercatolico.com.br/webhook/lead-capture \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "1008974418744113",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15556342089",
            "phone_number_id": "1138197429373798"
          },
          "contacts": [{"profile": {"name": "Operador Teste"}, "wa_id": "5583999931422"}],
          "messages": [{
            "from": "5583999931422",
            "text": {"body": "Lead: Maria Silva | 83 9 8888-7777"},
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

**Resultado esperado:**
- ✅ Card criado no topo da coluna **Leads** do Trello
- ✅ Mensagem de confirmação enviada para `5583999931422`
- ✅ Resposta `{"status": "ok", "received": true}` retornada

> **Nota:** A Meta também envia callbacks de **status** (leitura, entrega) que NÃO contêm `messages[]`. O workflow filtra automaticamente esses eventos (`skipReason: "Sem messages[] — provável status callback"`).

### Teste do Fluxo de Notificação de Corretores
Mova qualquer card no Trello para a lista **"Corretor Ágabo"** ou **"Corretora Samara"**. O n8n disparará e enviará o template `lead_atribuido_corretor` para o número configurado.

---

## 5. Importando os Workflows no n8n

Copie o JSON do arquivo e cole diretamente no n8n via **Import from JSON**.

| Arquivo | Finalidade |
|---|---|
| `workflow-meta-verify.json` | **Validação GET da Meta** — ativar só durante o cadastro do webhook |
| `workflow-lead-capture.json` | Captura de leads via WhatsApp → Trello (coluna Leads) |
| `workflow-completo.json` | Notificações Trello → WhatsApp + cards genéricos |
| `workflow_1.json` | Template base: WhatsApp → Trello (sem parsing) |
| `workflow_2.json` | Template base: Trello Trigger → WhatsApp (simples) |

---

## 6. Referências Rápidas do Projeto

| Recurso | Valor |
|---|---|
| URL pública n8n | `https://n8n.vivercatolico.com.br` |
| Tunnel ID (Cloudflare) | `83f60782-a2df-47bc-83df-4adea1f81a65` |
| Nome do Túnel | `trello_auto_zap` |
| Phone Number ID (Meta) | `1138197429373798` |
| Número de Teste (Meta) | `+1 555 634-2089` (raw: `15556342089`) |
| Credencial Trello (n8n ID) | `WGhjY0TBSOX8LgMk` |
| Board Trello ID | `6a1494722dc95789afdde69b` |
| Número Ágabo | `5583999931422` |
| Número Samara | `5583993685452` |
| Template WhatsApp | `lead_atribuido_corretor` (idioma: `pt_BR`) |
