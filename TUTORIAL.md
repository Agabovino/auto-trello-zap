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

> **Nota:** Todos os fluxos deste projeto utilizam requisições HTTP nativas consumindo a API Key e Token definidos diretamente no arquivo `.env` (com fallbacks de ID de Lista e Board), tornando a automação 100% autônoma e sem dependência de credenciais salvas no banco do n8n.

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

*   **Acesso Local:**
    ```bash
    curl http://localhost:8081
    # Deve retornar: {"status":"online"}
    ```
*   **Acesso Remoto:**
    ```bash
    curl https://evolution.vivercatolico.com.br
    # Deve retornar: {"status":"online"}
    ```

#### 2. Criar uma instância e conectar via QR Code (Remoto ou Local)

Você pode configurar a instância usando chamadas de API (substitua `localhost:8081` por `evolution.vivercatolico.com.br` se for remoto):

```bash
# 1. Criar instância
curl -X POST http://localhost:8081/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_EVOLUTION_API_KEY" \
  -d '{"instanceName": "meu-numero", "qrcode": true}'

# 2. Obter QR Code (formato base64 para escanear)
curl http://localhost:8081/instance/connect/meu-numero \
  -H "apikey: SUA_EVOLUTION_API_KEY"
```

Alternativamente, você pode usar a interface visual **Evolution API Manager** acessando:
👉 **`https://evolution.vivercatolico.com.br/manager/`** (ou `http://localhost:8081/manager/` localmente).

Abra o WhatsApp no celular → **Aparelhos conectados** → **Conectar aparelho** → Escaneie o QR Code retornado.

#### 3. Verificar conexão

```bash
curl http://localhost:8081/instance/fetchInstances \
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

### Fluxo 1 — Captura de Leads Automática (WhatsApp → Trello / coluna Leads)
**Arquivo:** `🔐 Meta Webhook Verification (GET).json` (ou `workflow-whatsapp-lead-auto.json` para o fluxo isolado)
**Endpoint:** `POST https://n8n.vivercatolico.com.br/webhook/lead-capture`

**Objetivo:** Qualquer pessoa que enviar uma mensagem para o número conectado vira um lead automaticamente no Trello, sem necessidade de enviar palavras-chave ou formatação específica. Não envia mensagens de resposta automáticas de volta para o cliente.

**Como funciona a Deduplicação:**
- Utiliza a propriedade `staticData` global do workflow do n8n para registrar cada número de telefone processado.
- Caso o mesmo número envie novas mensagens subsequentes, o fluxo ignora a criação de cards duplicados, garantindo que cada número gere um único card no Trello.

**Estrutura do Workflow (6 nós para o fluxo de Lead):**
1. **Webhook** — recebe `POST /webhook/lead-capture` (suporta Evolution API e Meta Cloud API).
2. **Code: Parsear Mensagem de Lead** — extrai o número (`senderPhone`) e o nome do contato (`pushName` / `profile.name` se disponíveis).
3. **Filter: É um Lead?** — valida o payload e garante que é uma mensagem individual de entrada válida.
4. **Code: Verificar Duplicata** — verifica no `staticData` se o número já foi cadastrado como lead.
5. **Filter: É Novo Lead?** — filtra permitindo a continuação apenas se for um novo lead.
6. **Trello: Criar Card** — cria o card no topo da lista "Leads" com o título `{Nome} ({Telefone})` ou `Lead {Telefone}` (se o nome for desconhecido).

**⚠️ Configuração obrigatória:**
- Substituir `SEU_LIST_ID_LEADS_AQUI` pelo ID real da lista "Leads" no nó Trello (ver seção anterior).


---

### Fluxo 2 — Notificações Trello → WhatsApp (Corretores)
**Arquivo:** `🔐 Meta Webhook Verification (GET).json`
**Objetivo:** Notificar Ágabo ou Brisa via WhatsApp ao mover um card para a coluna com o nome do corretor.

**Estrutura do Workflow:**
1. **Trello Trigger** — dispara ao mover/criar qualquer card no board `6a1494722dc95789afdde69b`
2. **Filter: É movimento de lista?** — garante que o movimento destino não está vazio
3. **Switch: Quem é o Corretor?** — roteia pelo nome da lista de destino:
   - Saída 0 → `"Corretor Ágabo"` → envia para o corretor Ágabo no número `5583999931422`
   - Saída 1 → `"Corretor Brisa"` → envia para a corretora Brisa no número `5583921485647` (número associado ao Evolution API)
4. **HTTP Request: Confirmar via WhatsApp** (Ágabo) — envia via Evolution API
5. **HTTP Request: Confirmar via WhatsApp2** (Brisa) — envia via Evolution API

> **Configuração:** As mensagens são enviadas via chamada POST da Evolution API para `http://evolution:8080/message/sendText/meu-numero`.

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
            "text": {"body": "Olá, gostaria de mais informações!"},
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

**Resultado esperado:**
- ✅ Card criado no topo da coluna **Leads** do Trello (com título `Operador Teste (5583999931422)`)
- ✅ Resposta `{"status": "ok", "received": true}` retornada
- ⚠️ Nenhuma mensagem é enviada de volta para o remetente (evitando spam)
- ⚠️ Se reenviar o comando para o mesmo número (`5583999931422`), o n8n ignorará e não gerará card duplicado.

> **Nota:** A Meta também envia callbacks de **status** (leitura, entrega) que NÃO contêm `messages[]`. O workflow filtra automaticamente esses eventos (`skipReason: "Sem messages[] — provável status callback"`).

### Teste do Fluxo de Notificação de Corretores
Mova qualquer card no Trello para a lista **"Corretor Ágabo"** ou **"Corretora Samara"**. O n8n disparará e enviará o template `lead_atribuido_corretor` para o número configurado.

---

## 5. Importando os Workflows no n8n

Copie o JSON do arquivo e cole diretamente no n8n via **Import from JSON** (ou importe arquivos via interface).

| Arquivo | Finalidade |
|---|---|
| `🔐 Meta Webhook Verification (GET).json` | **Workflow Principal Atualizado** — Contém o Webhook de validação da Meta, captura dinâmica de leads da Evolution API (com filtro de instância e deduplicação em tempo real direto no Trello) e envio automático de alertas para corretores quando cards são movidos. |
| `workflow-setup-trello-credential.json` | **Setup de Credenciais** — Cria/atualiza automaticamente a credencial Trello do n8n com base nas variáveis do arquivo `.env` (`TRELLO_API_KEY`, `TRELLO_TOKEN`). |
| `workflow-import-historical-contacts.json` | **Importação Histórica** — Puxa todos os contatos existentes de uma instância conectada e insere no Trello como lead se ainda não existirem. |
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

---

## 7. Solução de Problemas Comuns (Troubleshooting)

### ⚠️ Mensagens Presas em "PENDING" na Evolution API
Se as mensagens ficarem travadas em `PENDING` indefinidamente no banco de dados e não chegarem aos destinatários:
1. **Desconexão do Aparelho:** O WhatsApp pode ter desconectado a sessão a partir do aplicativo no celular (Aparelhos Conectados).
   * **Solução:** Delete/Deslogue a instância e refaça a conexão (escanear QR Code) no Evolution API Manager. O nome da instância **deve ser exatamente `meu-numero`**.
2. **Formato do Número (Região Nordeste / DDD 83):** Para DDDs fora do intervalo 11-27, o WhatsApp não utiliza o 9º dígito extra internamente nos identificadores JID. 
   * **Erro:** Se enviar para `55839921485647` (dois 9s), a Evolution API consultará o WhatsApp e receberá a resposta `"exists": false`, rejeitando o envio.
   * **Solução:** Envie para `5583921485647` (apenas um 9). A API normalizará o JID com sucesso.

### ⚠️ Erro de TypeError no Nó de Filtro (n8n)
* **Erro:** `TypeError: GenericFunctions_1.compareOperationFunctions[condition.operation] is not a function`.
* **Causa:** O nó de filtro (Filter V1) foi exportado/configurado com a operação `"notEmpty"`, mas em algumas versões do n8n a nomenclatura aceita é `"isNotEmpty"`.
* **Solução:** Edite o JSON do workflow ou o nó do filtro para garantir que a operação selecionada seja `"isNotEmpty"`.

---

## 8. Seleção de Instância Fonte e Importação Histórica

### 📱 Como selecionar qual número/instância gera Leads
A Evolution API suporta múltiplos números conectados (ex: `meu-numero`, `atendimoveis_meta`). Por padrão, você pode decidir qual delas o n8n vai processar editando o arquivo `.env`:

1. Abra o arquivo `.env`.
2. Edite a linha `EVOLUTION_INSTANCE`:
   * **Para filtrar apenas uma instância:** `EVOLUTION_INSTANCE=atendimoveis_meta`
   * **Para processar de QUALQUER número conectado:** `EVOLUTION_INSTANCE=` (deixe em branco)
3. Reinicie o container do n8n para aplicar:
   ```bash
   docker compose up -d n8n
   ```

### 🔄 Importação Retroativa de Contatos Antigos (Últimos 2 meses)
Como os webhooks de mensagens só disparam para **novas conversas recebidas**, as conversas históricas que você já possui na Evolution API não viram cards automaticamente. Para puxar esse histórico de forma segura:

1. Importe o arquivo `workflow-import-historical-contacts.json` no n8n.
2. Certifique-se de que a credencial Trello do workflow está configurada e selecionada no nó de Trello.
3. Clique em **"Execute Workflow"** (no editor do n8n) para rodar o trigger **Iniciar Importação Manual**.
4. O n8n executará o seguinte processo:
   * **Leitura da API do Trello e Evolution:** Busca todos os cards existentes do Trello e a lista completa de contatos e chats da Evolution API (executando cada chamada HTTP apenas 1 vez para evitar sobrecarga).
   * **Filtro de Data (Últimos 2 meses):** Filtra e retém apenas os contatos que tiveram interações nos últimos 2 meses (baseado na data da última mensagem/atualização do chat). Isso reduz a carga (ex: de ~3.000 contatos totais para cerca de 500 ativos).
   * **Ordenação Cronológica:** Organiza a lista do contato mais antigo para o mais recente. Como o Trello insere novos cards no topo (pos: top), isso garante que os contatos mais antigos fiquem no final/baixo da lista e os novos fiquem no topo.
   * **Controle de Rate Limit (Loop de 80 em 80):** O n8n dividirá a importação em lotes de 80 cards e aguardará 10 segundos entre cada lote, respeitando o limite rígido de requisições por token do Trello (100 reqs/10s).
   * **Mapeamento Robusto e Retry:** O nó do Trello está configurado para tentar novamente (até 5 vezes com intervalo de 5 segundos) em caso de instabilidades na rede (`ETIMEDOUT`) e lê o título diretamente da memória absoluta do loop (`{{ $('Split in Batches').item.json.cardTitle }}`), evitando a criação de cards vazios.


