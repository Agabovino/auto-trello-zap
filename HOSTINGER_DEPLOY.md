# 🚀 Guia de Deploy no Hostinger (VPS Docker)

Este guia contém as instruções completas para hospedar o **auto-trello-zap** em produção utilizando um servidor **VPS Hostinger** com **Docker Compose** e **Cloudflare Tunnels**.

---

## 🏗️ Diferença de Arquitetura: VPS vs. Hospedagem Compartilhada (hPanel)

| Recurso | Hospedagem Compartilhada / Cloud (hPanel Node Selector) | Hostinger VPS (Recomendado para este projeto) |
|---|---|---|
| **Suporte a Docker / Compose** | ❌ Não suportado | ✅ Suporte completo e nativo |
| **Execução do n8n + Evolution API** | ❌ Não é possível rodar daemons ou contêineres | ✅ Roda n8n, Evolution API, Postgres, Redis e Nginx |
| **Comunicação por Rede Interna** | ❌ Sem suporte a pontes DNS internas | ✅ Rede `n8n_network` integrada |
| **Exposição de Webhooks** | ⚠️ Requer Apache/Nginx do hPanel | ✅ Cloudflare Tunnels (SSL automático sem abrir portas) |

---

## 📋 Pré-requisitos

1. Um plano **VPS Hostinger** (qualquer plano VPS 1, VPS 2, etc.) com **Ubuntu 22.04 LTS ou 24.04 LTS**.
2. Acesso SSH ao seu servidor VPS.
3. Um domínio configurado no [Cloudflare](https://dash.cloudflare.com/) (com o Cloudflare Zero Trust ativado para Gerenciamento de Túneis).
4. Suas credenciais do Trello (API Key e Token).

---

## 🚀 Passo a Passo de Implantação

### ETAPA 1 — Conectar ao VPS via SSH

Abra seu terminal e conecte ao IP do seu VPS fornecido no painel da Hostinger:

```bash
ssh root@SEU_IP_HOSTINGER
```

---

### ETAPA 2 — Instalar Docker e Docker Compose no VPS

Se o seu VPS ainda não possui o Docker instalado, execute o comando de instalação oficial de linha única:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

Verifique se a instalação foi concluída com sucesso:

```bash
docker --version
docker compose version
```

---

### ETAPA 3 — Clonar ou Enviar o Projeto para o VPS

Crie a pasta do projeto e clone o repositório do Git (ou envie os arquivos via SCP/SFTP):

```bash
git clone https://github.com/SEU_USUARIO/auto-trello-zap.git /opt/auto-trello-zap
cd /opt/auto-trello-zap
```

---

### ETAPA 4 — Configurar o Arquivo de Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` a partir do modelo de exemplo:

```bash
cp .env.example .env
nano .env
```

Preencha os valores de produção de acordo com seus subdomínios e chaves:

```env
# Configurações do n8n
N8N_HOST=n8n.seudominio.com.br
N8N_PORT=5678
N8N_PROTOCOL=https

# URLs Públicas dos Serviços
WEBHOOK_URL=https://n8n.seudominio.com.br/
SERVER_URL=https://evolution.seudominio.com.br

# Chaves de Criptografia e Segurança (Gere strings aleatórias)
N8N_ENCRYPTION_KEY=sua_chave_secreta_n8n_aqui
EVOLUTION_API_KEY=sua_chave_api_evolution_aqui
N8N_API_KEY=sua_chave_api_n8n_aqui

# Fuso Horário
TIMEZONE=America/Sao_Paulo

# Tokens dos Túneis Cloudflare Zero Trust
TUNNEL_TOKEN=token_do_tunel_n8n
TUNNEL_TOKEN_EVOLUTION=token_do_tunel_evolution
TUNNEL_TOKEN_DASHBOARD=token_do_tunel_dashboard

# Instância WhatsApp padrão
EVOLUTION_INSTANCE=meu-numero

# Credenciais e IDs do Trello
TRELLO_API_KEY=sua_trello_api_key
TRELLO_TOKEN=seu_trello_token
TRELLO_BOARD_ID=seu_board_id_do_trello
TRELLO_LIST_ID=seu_list_id_leads_do_trello
```

---

### ETAPA 5 — Configurar os Roteamentos no Cloudflare Zero Trust

No painel do Cloudflare:
1. Acesse **Zero Trust** > **Networks** > **Tunnels**.
2. Obtenha os tokens para os 3 túneis (ou 1 túnel unificado com múltiplos Public Hostnames) e configure os roteamentos de serviço interno da rede Docker:

| Subdomínio Público | Serviço Destino Interno (Docker DNS) | Porta |
|---|---|---|
| `n8n.seudominio.com.br` | `HTTP://n8n` | `5678` |
| `evolution.seudominio.com.br` | `HTTP://evolution` | `8080` |
| `dashboard.seudominio.com.br` | `HTTP://dashboard` | `80` |

> 💡 **Nota Importante:** Note que no Cloudflare Tunnel apontamos para os nomes dos serviços Docker (`http://n8n:5678` e `http://evolution:8080`), permitindo comunicação direta sem expor portas do servidor para a internet.

---

### ETAPA 6 — Iniciar a Aplicação no VPS

Execute o Docker Compose para baixar as imagens e iniciar todos os 6 serviços:

```bash
docker compose up -d
```

Para verificar o status da execução e a integridade de todos os contêineres:

```bash
docker compose ps
```

---

### ETAPA 7 — Conectar o WhatsApp na Evolution API

1. Acesse o **Dashboard Visual** em `https://dashboard.seudominio.com.br` ou o **Manager da Evolution API** em `https://evolution.seudominio.com.br/manager/`.
2. Conecte-se com a sua `EVOLUTION_API_KEY`.
3. Selecione ou crie a instância `meu-numero`.
4. Escaneie o **QR Code** no seu WhatsApp para autenticar o número.

---

## 🛠️ Comandos de Manutenção no VPS Hostinger

```bash
# Ver os logs de todos os serviços em tempo real
docker compose logs -f

# Ver logs de um serviço específico (ex: n8n ou evolution)
docker compose logs -f n8n
docker compose logs -f evolution

# Reiniciar todos os serviços
docker compose restart

# Atualizar o projeto para a última versão do repositório
git pull
docker compose up -d --build
```

---

## 🐛 Resolução de Problemas (Troubleshooting)

### 1. Erro 502 Bad Gateway no Cloudflare
* **Causa:** O túnel Cloudflare ainda está estabelecendo conexão ou o nome do host destino foi digitado como `localhost` em vez do nome do serviço interno Docker (`n8n` / `evolution` / `dashboard`).
* **Solução:** No painel Zero Trust do Cloudflare, confirme se a URL do serviço é `http://n8n:5678` e não `http://localhost:5678`.

### 2. Mensagens do WhatsApp não criam cards no Trello
* **Causa:** Webhook global da Evolution API desalinhado com o n8n.
* **Solução:** Verifique no `.env` se `WEBHOOK_URL` está com a barra final (`https://n8n.seudominio.com.br/`). A Evolution API envia webhooks internos para `http://n8n:5678/webhook/lead-capture`.

### 3. Fuso Horário incorreto no n8n
* **Causa:** Variável `TIMEZONE` não informada.
* **Solução:** Defina `TIMEZONE=America/Sao_Paulo` no `.env` e reinicie o n8n (`docker compose restart n8n`).
