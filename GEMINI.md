# auto-trello-zap

Este projeto fornece um ambiente dockerizado para o n8n, configurado para automações bidirecionais entre Trello e WhatsApp, utilizando Cloudflare Tunnels para exposição segura de webhooks.

## 🏗️ Arquitetura do Ambiente

- **n8n:** O motor de automação (porta interna 5678).
- **Evolution API:** API de integração do WhatsApp via Baileys (porta externa 8081).
- **PostgreSQL:** Banco de dados relacional para a Evolution API.
- **Redis:** Gerenciador de fila e cache para sessões da Evolution API.
- **Cloudflared:** Dois clientes de Cloudflare Tunnel dedicados para exposição segura dos subdomínios `n8n.vivercatolico.com.br` e `evolution.vivercatolico.com.br`.
- **Docker Network:** Todos os serviços rodam na rede `n8n_network`, permitindo conexões diretas via hostname DNS interno do Docker (ex: `http://n8n:5678` e `http://evolution:8080`).

## 🛠️ Stack Tecnológica

- **Docker / Docker Compose**
- **n8n** (Automation Tool)
- **Evolution API** (WhatsApp Integration API)
- **PostgreSQL 15** (Relational Database)
- **Redis 7** (Cache & Queuing)
- **Cloudflare Tunnel** (Ingress/Proxy)
- **GitHub CLI** (Gestão de Repositório)

## 📋 Configuração de Webhooks

Para que os gatilhos externos funcionem (Trello e WhatsApp), as seguintes URLs devem ser configuradas:

1.  **n8n Webhook URL:** `https://n8n.vivercatolico.com.br/`
2.  **Trello Trigger:** Configurado via nó `Trello Trigger` no n8n.
3.  **WhatsApp/Evolution API:** Configurado globalmente ou por instância apontando para `http://n8n:5678/webhook/lead-capture` (comunicação de rede interna).

## 🚀 Comandos Úteis

```bash
# Iniciar o ambiente
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Validar comunicação interna (Tunnel -> n8n)
docker exec auto_trello_zap-tunnel-1 curl -I http://n8n:5678
```

## 📖 Documentação Adicional

- [TUTORIAL.md](./TUTORIAL.md): Guia passo a passo para configuração do ambiente e integração detalhada das credenciais do WhatsApp (Evolution API / Meta Cloud API) e Trello.

## 🧠 Memória do Projeto

- **Túnel n8n:** ID `83f60782-a2df-47bc-83df-4adea1f81a65` (Nome: `trello_auto_zap`)
- **Túnel Evolution:** ID `46bff066-a990-4081-8812-30896245c338` (Configurado via `TUNNEL_TOKEN_EVOLUTION`)
- **Domínio Principal:** `vivercatolico.com.br`
- **Subdomínios:**
    - n8n: `n8n.vivercatolico.com.br`
    - Evolution API & Manager: `evolution.vivercatolico.com.br` (Interface visual em `/manager/`)
- **Status da Doc:** Atualizado com túnel gerenciado via painel do Cloudflare e sem arquivos de credenciais locais.
- **Correções Recentes:**
    - Configurado acesso remoto seguro para a **Evolution API** e o seu **Manager** através de um túnel dedicado do Cloudflared (`tunnel-evolution`) apontando para o subdomínio `evolution.vivercatolico.com.br` na porta interna `8080` (porta `8081` externa no host), com acesso visual em `/manager/`.
    - Migrado túnel local para túnel gerenciado (Managed Tunnel) usando `TUNNEL_TOKEN`.
    - Atualizado `docker-compose.yml` para consumir o token do túnel sem expor arquivos locais.
    - Configurado `N8N_TRUST_PROXY=true` e `N8N_PROXY_HOPS=1` para estabilidade da interface UI.
    - Instalado Docker e Docker Compose no Ubuntu 26.04.
    - Centralizada a busca e extração de dados do card do Trello (nome, descrição, responsável e telefone do cliente via campos customizados ou parsing de descrição) antes do nó Switch.
    - Criado o fluxo `workflow-meta-verify.json` para responder à verificação GET obrigatória da Meta (evitando erro #1004).
    - Adicionado suporte à **Evolution API v2** no `docker-compose.yml` com banco de dados **PostgreSQL** e **Redis** dedicado para gerenciar filas de mensagens.
    - Resolvido conflito de porta da Evolution API (alterada de `8080` para `8081` para não colidir com o `fish-speech-server`).
    - Desenvolvida lógica de **Regex ultra robusta** para extração de telefones (aceita DDD separado, 9 dígitos com espaços, etc.) e nomes case-insensitive.
    - Configurado o nó `Confirmar via WhatsApp` para enviar as mensagens através da Evolution API usando a rede Docker interna (`http://evolution:8080/message/sendText/...`) com tratamento de quebras de linha (`JSON.stringify`).
    - Removido workflows duplicados no banco de dados SQLite do n8n para prevenir colisões de registro de webhook.
    - Corrigido e habilitado o fluxo de movimentação de cards no arquivo `🔐 Meta Webhook Verification (GET).json`, implementando regras de filtragem de listas reais e envio de notificações via Evolution API para os corretores Ágabo (`5583999931422`) e Brisa (`5583921485647`).
    - Configurada e testada com sucesso a chave da API pública do n8n (`N8N_API_KEY`) no arquivo `.env` para controle remoto e automações programáticas adicionais.
    - Identificado e corrigido erro de `TypeError` no nó de filtro `É movimento de lista?` no workflow `🔐 Meta Webhook Verification (GET).json`, alterando a operação `"notEmpty"` para `"isNotEmpty"`.
    - Solucionado o problema de mensagens de saída presas em `PENDING` na Evolution API por meio da recriação e reconexão da instância `meu-numero` via QR Code.
    - Corrigido o número telefônico da corretora Brisa no nó `Confirmar via WhatsApp2` para `5583921485647` (com apenas um 9), pois o WhatsApp rejeita o formato de duplo 9 (`55839921485647`) no JID interno para o DDD 83, retornando `"exists": false`.
    - **Redesenhada a lógica de captura de leads (via API do n8n):** qualquer mensagem recebida no WhatsApp (Evolution API ou Meta) agora gera um lead no Trello automaticamente — sem necessidade de o texto conter palavra-chave "lead". O fluxo não envia mais mensagem de resposta para o lead. O card contém nome (pushName do WhatsApp, se disponível) e número. Implementada **deduplicação via `$getWorkflowStaticData('global')`**: um mesmo número nunca vira dois cards diferentes. Novos nós adicionados: `Verificar Duplicata` (Code) e `É Novo Lead?` (Filter). O nó `Parsear Mensagem de Lead` foi reescrito para extrair `senderPhone`/`senderName` de qualquer evento `messages.upsert` da Evolution API ou webhook da Meta, ignorando mensagens próprias (`fromMe=true`) e grupos (`@g.us`).


---
*Gerado automaticamente pelo Gemini CLI para contextualização do workspace.*

