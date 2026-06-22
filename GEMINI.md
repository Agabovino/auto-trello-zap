# auto-trello-zap

Este projeto fornece um ambiente dockerizado para o n8n, configurado para automações bidirecionais entre Trello e WhatsApp, utilizando Cloudflare Tunnels para exposição segura de webhooks.

## 🏗️ Arquitetura do Ambiente

- **n8n:** O motor de automação (porta interna 5678).
- **Cloudflared:** Cliente do Cloudflare Tunnel para exposição do subdomínio `n8n.vivercatolico.com.br`.
- **Docker Network:** Ambos os serviços rodam na rede `n8n_network`, permitindo que o túnel acesse o n8n via `http://n8n:5678`.

## 🛠️ Stack Tecnológica

- **Docker / Docker Compose**
- **n8n** (Automation Tool)
- **Cloudflare Tunnel** (Ingress/Proxy)
- **GitHub CLI** (Gestão de Repositório)

## 📋 Configuração de Webhooks

Para que os gatilhos externos funcionem (Trello e WhatsApp), as seguintes URLs devem ser configuradas:

1.  **n8n Webhook URL:** `https://n8n.vivercatolico.com.br/`
2.  **Trello Trigger:** Configurado via nó `Trello Trigger` no n8n.
3.  **WhatsApp API:** Webhook apontando para `https://n8n.vivercatolico.com.br/webhook/whatsapp-to-trello`.

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

- [TUTORIAL.md](./TUTORIAL.md): Guia passo a passo para configuração do ambiente e integração detalhada das credenciais do WhatsApp (Meta Cloud API) e Trello.

## 🧠 Memória do Projeto

- **Tunnel ID:** `83f60782-a2df-47bc-83df-4adea1f81a65`
- **Nome do Túnel:** `trello_auto_zap` (Gerenciado via Cloudflare Zero Trust Dashboard)
- **Domínio Principal:** `vivercatolico.com.br`
- **Subdomínio n8n:** `n8n.vivercatolico.com.br`
- **Status da Doc:** Atualizado com túnel gerenciado via painel do Cloudflare e sem arquivos de credenciais locais.
- **Correções Recentes:**
    - Migrado túnel local para túnel gerenciado (Managed Tunnel) usando `TUNNEL_TOKEN`.
    - Atualizado `docker-compose.yml` para consumir o token do túnel sem expor arquivos locais.
    - Configurado `N8N_TRUST_PROXY=true` e `N8N_PROXY_HOPS=1` para estabilidade da interface UI.
    - Instalado Docker e Docker Compose no Ubuntu 26.04.

---
*Gerado automaticamente pelo Gemini CLI para contextualização do workspace.*
