---
name: company-os
description: Company-OS is an AI-powered visual virtual office SDK. Use this skill whenever the user wants to start their virtual office dashboard, scan a project, or orchestrate agents. Important: this server acts only as a state/visual engine. The Anthropic API calls must be executed by YOU (the Antigravity IDE) sending instructions to the server's REST API.
---

# Company-OS Skill

Company-OS is a visual virtual office SDK that scans a Node.js project, generates a `context.json` snapshot, and populates a 2D HTML5 Canvas office with agents representing team members.

Unlike autonomous agents, **Company-OS operates as a passive skill controlled entirely by the IDE (Antigravity).** The server does not make any AI API calls itself. Instead, it exposes REST endpoints that the IDE uses to instruct the agents what to say, and the server renders these actions visually in the virtual office.

**Nenhuma chave da API da Anthropic é necessária no `.env` do projeto.** A inteligência é provida diretamente pela sua IDE (como no OpenSquad).

## 🚀 Como Iniciar

### 1 — Iniciar o Servidor Visual

```bash
npx company-os start
# ou
node dist/index.js start
```

- Abre o dashboard `http://localhost:3000`.
- O servidor fica apenas aguardando comandos via REST API para animar os agentes.

### 2 — Scan Opcional

```bash
npx company-os scan
```

- Atualiza o arquivo `.company-os/context.json` (que o Antigravity pode ler para entender o projeto no qual os agentes estão trabalhando).

---

## 🤖 Como a IDE controla os agentes (Orquestração Ativa)

Como Antigravity, **você** é responsável por gerar os pensamentos dos agentes e enviá-los para o servidor. 

### A - Fazer um Agente Falar

Quando o usuário pedir algo como *"O que o Frontend acha disso?"*, você deve:
1. Buscar o contexto do agente (`GET /api/agents/:id/context`).
2. Gerar a resposta internamente usando o seu próprio modelo de linguagem.
3. Enviar a resposta para o servidor para animar o boneco (`POST /api/agents/:id/speak`).

```bash
# Exemplo de payload para o POST /api/agents/:id/speak
{
  "question": "A pergunta original",
  "answer": "A resposta gerada por você"
}
```

### B - Conduzir uma Reunião (Meeting)

Quando o usuário falar *"Convoque uma daily meeting"*, você deve coordenar a reunião passo a passo fazendo as chamadas REST:

1. Iniciar a reunião visualmente:
   ```http
   POST /api/visual/meetings/convoke
   { "type": "daily", "topic": "Daily Standup", "attendees": ["id-1", "id-2"] }
   ```
2. Para cada agente na reunião, gere o que ele diria e faça-o falar:
   ```http
   POST /api/visual/meetings/speak
   { "agentId": "id-1", "message": "Estou trabalhando no frontend hoje." }
   ```
3. Aguarde alguns segundos (usando sleep no seu prompt) para dar tempo da animação rolar.
4. Finalize a reunião:
   ```http
   POST /api/visual/meetings/conclude
   { "conclusion": "Reunião concluída.", "actionItems": ["Revisar PRs"], "mood": "positive" }
   ```

---

## 🏗️ Endpoints do Servidor (REST API)

Todos os endpoints rodam em `http://localhost:3000` (ou na porta configurada).

### Gestão
- `GET /api/agents` -> Lista todos os times e agentes.
- `GET /api/project/context` -> Retorna os dados do projeto atual (`context.json`).

### Comunicação (Usado por você)
- `GET /api/agents/:id/context` -> Retorna `{ systemPrompt, memory, currentTask }`.
- `POST /api/agents/:id/speak` -> Faz o agente exibir a mensagem na tela. (Recebe `{ question, answer }`).

### Reuniões
- `POST /api/visual/meetings/convoke` -> Inicializa a fase de encontro na tela.
- `POST /api/visual/meetings/speak` -> Faz um agente específico falar na reunião e os outros prestarem atenção.
- `POST /api/visual/meetings/conclude` -> Salva a ata e encerra a reunião, fazendo os agentes retornarem às mesas.

---

## 🛡️ Atribuições do Antigravity

Como esse sistema é uma "Skill Passiva", não espere que o servidor tenha iniciativa. 

**Toda vez que o usuário pedir para debater uma ideia, iniciar uma reunião ou consultar uma equipe**, você (Antigravity) precisa fazer o *roleplay* dessas entidades e usar a ferramenta `run_command` com chamadas `curl` para enviar suas falas geradas para o servidor Company-OS ativo, tornando a experiência visual e integrada.
