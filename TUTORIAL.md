# Tutorial: Automação Trello <-> WhatsApp com n8n

Este guia fornece instruções passo a passo para configurar um ambiente dockerizado do n8n e implementar fluxos de automação bidirecionais entre o Trello e o WhatsApp.

## 1. Configuração do Ambiente Docker

### Pré-requisitos
- Docker e Docker Compose instalados.
- Um domínio ou túnel (Ngrok/Cloudflare) para receber webhooks.

### Instalação
1. Clone este repositório ou copie os arquivos `docker-compose.yml` e `.env.example`.
2. Renomeie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edite o arquivo `.env` e preencha a variável `WEBHOOK_URL` com a URL pública onde seu n8n será acessível (ex: `https://meu-n8n.com/`).
4. Gere uma chave aleatória para `N8N_ENCRYPTION_KEY`.
5. Suba o contêiner:
   ```bash
   docker-compose up -d
   ```
6. Acesse o n8n em `http://localhost:5678`.

---

## 2. Configuração de Credenciais

### Trello
1. Acesse [Trello Power-Ups Admin](https://trello.com/power-ups/admin).
2. Crie um novo Power-Up para obter sua **API Key**.
3. Gere um **Token** de acesso clicando no link de autorização fornecido na mesma página.

### WhatsApp (Evolution API / Cloud API)
- **Evolution API:** Você precisará da URL da instância e da `apikey`.
- **WhatsApp Cloud API (Oficial):** Você precisará do `Access Token`, `Phone Number ID` e `WhatsApp Business Account ID`.

---

## 3. Fluxos de Automação

### Fluxo 1: WhatsApp -> Trello (Input de Usuários)
**Objetivo:** Criar um card no Trello a partir de uma mensagem recebida no WhatsApp.

**Estrutura do Workflow:**
1.  **Webhook Node:** Configurado para ouvir eventos `messages.upsert` (formato Evolution API).
    - HTTP Method: POST
2.  **Switch/Set Node:** Extrair o número do remetente e o texto da mensagem.
    - Exemplo de Expressão para Nome: `{{ $json.body.instance.name }}`
    - Exemplo de Expressão para Texto: `{{ $json.body.data.message.conversation }}`
3.  **Trello Node:**
    - Resource: Card
    - Operation: Create
    - List ID: (ID da coluna onde o card será criado)
    - Name: `Nova mensagem de {{ $json.sender_name }}`
    - Description: `Mensagem: {{ $json.message_text }}`

### Fluxo 2: Trello -> WhatsApp (Notificações)
**Objetivo:** Notificar via WhatsApp quando um card for movido para a coluna "Concluído".

**Estrutura do Workflow:**
1.  **Trello Trigger Node:**
    - Event: Card moved to List.
    - List: "Concluído" (Selecione a lista específica).
2.  **Trello Node (Opcional):** Se precisar de mais detalhes do card que o gatilho não enviou.
3.  **HTTP Request Node (WhatsApp API):**
    - Method: POST
    - URL: `https://sua-api-whatsapp.com/message/sendText`
    - Body:
      ```json
      {
        "number": "{{ $json.responsavel_celular }}",
        "text": "O card *{{ $json.name }}* foi movido para Concluído!"
      }
      ```

---

## 4. JSON dos Workflows
Para importar os workflows abaixo, copie o JSON e cole diretamente na tela do n8n.

*(Ver arquivos workflow_1.json e workflow_2.json neste repositório)*
