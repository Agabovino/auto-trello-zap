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

### WhatsApp Cloud API (via Meta Developers Console - Oficial)

Esta é a forma oficial e gratuita (até certos limites) de integrar o WhatsApp.

#### 1. Criar um Aplicativo no Meta for Developers
1. Acesse o [Meta for Developers](https://developers.facebook.com/) e faça login.
2. Clique em **Meus Aplicativos** > **Criar Aplicativo**.
3. Selecione o tipo de aplicativo **Outro** e clique em **Próximo**.
4. Selecione **Empresa** como o tipo de aplicativo.
5. Dê um nome ao aplicativo (ex: `n8n-automation`) e clique em **Criar Aplicativo**.

#### 2. Configurar o Produto WhatsApp
1. No painel do seu aplicativo, role para baixo até encontrar **WhatsApp** e clique em **Configurar**.
2. Selecione ou crie uma **Conta de Negócios do Meta** (WABA) e clique em **Continuar**.

#### 3. Obter Credenciais Temporárias (Para Testes)
1. No menu lateral esquerdo, vá em **WhatsApp** > **Configuração de API**.
2. Aqui você encontrará:
   - **Token de acesso temporário:** (Válido por 24 horas).
   - **ID do número de telefone:** (Phone Number ID).
   - **ID da conta do WhatsApp Business:** (WABA ID).
3. Adicione o seu próprio número de celular na seção **Para** para testar o envio de mensagens.

#### 4. Configurar Webhooks (Para receber mensagens)
1. No menu lateral, vá em **WhatsApp** > **Configuração**.
2. Em **Webhook**, clique em **Editar**.
3. **URL de retorno:** Insira a URL do seu Webhook do n8n (ex: `https://n8n.vivercatolico.com.br/webhook/whatsapp-to-trello`).
4. **Token de verificação:** Crie uma senha qualquer (você usará a mesma no n8n).
5. Clique em **Salvar**.
6. Clique em **Gerenciar** e assine o campo `messages` para receber notificações de novas mensagens.

#### 5. Configurar no n8n
1. No n8n, adicione um novo nó **WhatsApp Cloud API**.
2. Crie uma nova credencial:
   - **Access Token:** O token gerado no passo 3 (ou um token permanente).
   - **Phone Number ID:** O ID obtido no passo 3.
   - **WhatsApp Business Account ID:** O ID obtido no passo 3.
3. Se estiver usando o nó de gatilho (**WhatsApp Trigger**), configure o **Verify Token** com a mesma senha que você criou no passo 4.3.

### WhatsApp (Evolution API - Alternativa)
- **Evolution API:** Uma API Open Source que permite conectar números de WhatsApp via QR Code. Você precisará da URL da sua instância e da `apikey`. Útil se você não quiser usar a API oficial do Meta.

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


