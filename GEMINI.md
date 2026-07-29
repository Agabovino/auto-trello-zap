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
- [HOSTINGER_DEPLOY.md](./HOSTINGER_DEPLOY.md): Guia completo de implantação em produção no Hostinger VPS utilizando Docker Compose e Cloudflare Tunnels.

## 🧠 Memória do Projeto

- **Túnel n8n:** ID `83f60782-a2df-47bc-83df-4adea1f81a65` (Nome: `trello_auto_zap`)
- **Túnel Evolution:** ID `46bff066-a990-4081-8812-30896245c338` (Configurado via `TUNNEL_TOKEN_EVOLUTION`)
- **Domínio Principal:** `vivercatolico.com.br` (ou qualquer domínio configurado na Hostinger/Cloudflare)
- **Subdomínios:**
    - n8n: `n8n.vivercatolico.com.br`
    - Evolution API & Manager: `evolution.vivercatolico.com.br` (Interface visual em `/manager/`)
- **Status da Doc:** Atualizado com túnel gerenciado via painel do Cloudflare e guia de hospedagem no Hostinger VPS.
- **Correções Recentes:**
    - **Preparado Deploy para Hostinger (VPS Docker):** Criado o documento [HOSTINGER_DEPLOY.md](./HOSTINGER_DEPLOY.md) detalhando o deploy completo do ecossistema via Hostinger VPS (Ubuntu com Docker Compose) e Cloudflare Tunnels.
    - **Parametrização Dinâmica do Dashboard no Hostinger:** Atualizados `dashboard/env-injector.sh`, `dashboard/app.js` e `docker-compose.yml` para injetar `WEBHOOK_URL`, `SERVER_URL`, `EVOLUTION_API_KEY` e `TRELLO_API_KEY` dinamicamente no frontend `env.js`, permitindo que o Dashboard funcione 100% hospedado na Hostinger com domínios customizados sem qualquer alteração de código.
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
    - Implementada deduplicação em tempo real no Trello (nó **Buscar Cards Existentes (Trello)**), consultando a API do Trello para garantir que contatos duplicados não sejam reinseridos mesmo se o n8n for reiniciado.
    - Adicionado suporte a múltiplos números e filtragem de leads por instância da Evolution API via variável de ambiente `EVOLUTION_INSTANCE` (no `.env`), e corrigido o erro `ReferenceError: process is not defined` no sandbox do n8n utilizando um nó do tipo `Set` para passar as variáveis de ambiente com segurança ao nó `Code`.
    - Criado o fluxo de importação manual `workflow-import-historical-contacts.json` para importar de forma retroativa os contatos de qualquer instância da Evolution API para o Trello, aplicando a nova deduplicação real do Trello.
    - **Adicionado filtro de data (últimos 2 meses) na importação histórica:** O fluxo agora consulta também o endpoint `/chat/findChats` para capturar a data da última conversa (`updatedAt`), ignorando contatos sem interação recente.
    - **Correção da ordem cronológica da importação:** Os contatos são ordenados do mais antigo para o mais novo no nó de código, garantindo que os leads mais novos fiquem no topo da lista Leads do Trello (pos: top) e os antigos embaixo.
    - **Correção de loop n8n e cards vazios:** Ajustado o mapeamento no nó Trello para usar `{{ $('Split in Batches').item.json.cardTitle }}`, resolvendo o bug de perda de referência de índice que gerava cards vazios a partir do segundo lote (card 80+).
    - **Tratamento de Rate Limit e Timeout:** Adicionado o nó `Wait 10s` entre os lotes de 80 cards e ativado o `retryOnFail` (5 tentativas com 5s de intervalo) no nó do Trello para evitar erros `API_TOKEN_LIMIT_EXCEEDED` e timeouts `ETIMEDOUT`.
    - **Habilitado acesso a variáveis no n8n:** Adicionado `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` no `docker-compose.yml` para corrigir o erro `access to env vars denied` nas expressões do n8n.
    - **Redesenhada a lógica de captura de leads (via API do n8n):** qualquer mensagem recebida no WhatsApp (Evolution API ou Meta) agora gera um lead no Trello automaticamente — sem necessidade de o texto conter palavra-chave "lead". O fluxo não envia mais mensagem de resposta para o lead. O card contém nome (pushName do WhatsApp, se disponível) e número. Implementada **deduplicação via `$getWorkflowStaticData('global')`**: um mesmo número nunca vira dois cards diferentes. Novos nós adicionados: `Verificar Duplicata` (Code) e `É Novo Lead?` (Filter). O nó `Parsear Mensagem de Lead` foi reescrito para extrair `senderPhone`/`senderName` de qualquer evento `messages.upsert` da Evolution API ou webhook da Meta, ignorando mensagens próprias (`fromMe=true`) e grupos (`@g.us`).
    - **Dashboard Visual Atualizado:** Refatoração da interface HTML/JS do dashboard para melhor UX. Melhorado o fluxo de integração OAuth com o Trello, adicionando exibição clara da Origem Permitida (Allowed Origins) e da API Key a ser copiada. A fonte global do dashboard foi padronizada usando estilo "Medium" para maior legibilidade.
    - **Indicador de Fonte de Leads:** Na aba de conexões do Evolution API, foi incluído um indicativo visual para destacar qual instância específica (definida por `EVOLUTION_INSTANCE` no `.env`) atua como fonte oficial de captura de leads, garantindo clareza caso múltiplos números estejam conectados ao mesmo servidor.
    - **Histórico de Leads e Correções:** Criada nova aba "Histórico de Leads" no dashboard que busca todos os cards abertos no Trello, classificados por ordem de modificação, usando diretamente a API do Trello. Corrigido bug de navegação (array `sections`) que ocultava a aba e causava tela branca.
    - **Parametrização de IDs do Trello no n8n:** Removidos IDs estáticos (`listId` e `boardId`) diretamente dos nós no n8n (`🔐 Meta Webhook Verification (GET).json` e `workflow-import-historical-contacts.json`). Eles agora são obtidos dinamicamente através de expressões (`{{ $env.TRELLO_LIST_ID }}` e `{{ $env.TRELLO_BOARD_ID }}`).
    - **Acesso a Variáveis de Ambiente no n8n:** Adicionada a flag `N8N_ENV_VARS_ALLOW_ACCESS=EVOLUTION_INSTANCE,TRELLO_LIST_ID,TRELLO_BOARD_ID,N8N_API_KEY` ao `docker-compose.yml` para permitir o uso da sintaxe de expressões interpoladas (`=https://.../{{ $env.TRELLO_LIST_ID }}/...`) contornando o erro de *access denied* e as limitações de CORS.
    - **Limpeza de UI e Correção de Cache CORS:** Removidos botões redundantes de sincronização do Trello na interface do dashboard. O caminho do webhook manual foi corrigido para `manual-trello-sync` no n8n e o script `app.js` foi configurado com `mode: 'no-cors'` e versionamento cache-busting (`?v=2.x`) para evitar bloqueios preflight do navegador.
    - **Prevenção de Erros no Console:** Desabilitadas requisições padrão para webhooks de estatísticas inexistentes (`dashboard-stats` e `dashboard-last-sync`), utilizando os fallbacks locais para evitar poluição de erros CORS no console do usuário.
    - **Parametrização Autônoma do Trello via HTTP Request:** Todos os nós de busca e criação no Trello foram convertidos para requisições HTTP nativas consumindo `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_LIST_ID` e `TRELLO_BOARD_ID` das variáveis de ambiente com fallbacks de ID (`{{ $env.TRELLO_LIST_ID || '6a68e0681ad8093e17b2fb61' }}`). Isso tornou o fluxo 100% livre de dependência de credenciais salvas no banco SQLite do n8n.
    - **Leitura Direta da Instância Sem Perda de Payload:** Atualizado o nó de código no n8n para ler `EVOLUTION_INSTANCE` diretamente do ambiente (`process.env.EVOLUTION_INSTANCE || $env.EVOLUTION_INSTANCE`), eliminando o nó *Set* intermediário que resetava o corpo do webhook e causava rejeição de mensagens por "Formato não reconhecido".
    - **Formatação de Notificação do WhatsApp com Link Clicável (`https://wa.me/`):** Atualizada a mensagem de notificação enviada aos corretores ao mover cards no Trello. Os parênteses ao redor do número foram removidos e foi adicionado um link direto clicável do WhatsApp (`https://wa.me/[numero]`), mantendo o nome do lead quando disponível (ex: `"Olá! O lead Jean Nascimento https://wa.me/558197537309 foi adicionado à sua coluna!"`).
    - **Resolução de Erro de Sintaxe em Expressões do n8n (IIFE):** Corrigido erro `ERROR: invalid syntax` nas expressões do n8n utilizando a estrutura de função autoexecutável `={{ (() => { ... })() }}`, permitindo declarações multilinhas e processamento avançado de strings antes do retorno do objeto JSON para a Evolution API.
    - **Preservação de Corretores Personalizados:** Preservados e validados todos os nós de corretores adicionados no fluxo `🔐 Meta Webhook Verification (GET).json` (Jean, Ana Paula, Gustavo, Isabelle, Karla).
---
*Gerado automaticamente pelo Gemini CLI para contextualização do workspace.*

