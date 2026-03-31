# 🏢 Company-OS (Passive Skill)

> Um motor gráfico de escritório virtual 2D para agentes AI. Projetado para ser executado **exclusivamente como uma Skill** dentro de IDEs autônomas (como Claude Code ou Antigravity).

O **Company-OS** instala-se em qualquer projeto Node.js, mapeia a estrutura (`context.json`) e cria uma interface estilo Terraria/Habbo com avatares representando membros da equipe. 

**IMPORTANTE:** O Company-OS **NÃO faz chamadas à API da Anthropic**. Ele atua como um sistema passivo de *estado visual*. A inteligência dos agentes vem da sua própria IDE, que opera os bonecos através da nossa REST API. Nenhuma chave API (`.env`) é necessária no projeto.

---

## 🚀 Instalação

### Via Claude Code Marketplace (Recomendado)

Instale diretamente no Claude Code com dois comandos:

```
/plugin marketplace add minattinho/company-os
/plugin install company-os@company-os
```

A skill **company-os** estará disponível automaticamente no Claude Code após a instalação.

---

### Via npm (Global)

Para usar os comandos diretamente no terminal de qualquer projeto:

```bash
npm install -g company-os
```

Depois, de dentro de qualquer projeto:

```bash
company-os start              # Inicia o servidor visual
company-os scan               # Escaneia o projeto atual
company-os scan --path ./app  # Escaneia outro diretório
```

> Se a porta 3000 já estiver em uso: `company-os start -p 4000`

### Uso na IDE após instalar

1. Abra o Claude Code no diretório do seu projeto.
2. Inicie o servidor: `company-os start`
3. Abra **http://localhost:3000** para ver o escritório.
4. Peça para a IDE interagir com os agentes. Exemplos:
   - *"Convoque uma daily meeting com todos os agentes."*
   - *"Faça o Backend falar o que acha dessa função."*

**A IDE consultará a REST API do Company-OS para animar os agentes e exibir as respostas nos balões de fala.**

---

## 🎮 Interface Visual (Dashboard)

Enquanto a IDE coordena as reuniões e respostas, você pode interagir com o ambiente:

| Tecla / Ação | Descrição |
|-----|--------|
| `N` | Contratar um novo agente (Manequins são criados na hora). |
| `T` | Criar um novo Departamento (Team). |
| `M` | Iniciar uma reunião genérica manualmente. |
| `R` | Escanear o projeto novamente (Atualiza o `context.json`). |
| `Space` | Pausar/Retomar o motor gráfico. |
| `Tab` | Alternar a câmera entre os agentes disponíveis. |
| `ESC` | Fechar abas abertas. |
| `Click` no agente | Abre a ficha criminal/status do agente. |
| `Scroll` / `Wheel` | Zoom In ou Zoom Out. |
| `Arrastar Meio` | Mover a câmera livremente pelo escritório. |

---

## 🤖 Operação Ativa pela IDE (Para Mentes Artificiais Lendo Isso)

Se você é o **Antigravity** executando essa skill, o servidor aguarda seus comandos:

### Endpoints Livres (localhost:3000)

1. **Listar Agentes**  
   `GET /api/agents` (Retorna a lista completa com os `IDs` dos agentes).

2. **Obter Contexto do Agente**  
   `GET /api/agents/:id/context` (Retorna a personalidade base do agente, última tarefa e memória recente para você preparar o Prompt).

3. **Animar a Fala**  
   `POST /api/agents/:id/speak`  
   **Payload:** `{ "question": "motivo da fala", "answer": "O que o agente irá exibir no balão" }`

4. **Conduzir Reunião (Meeting)**  
   - INICIAR: `POST /api/visual/meetings/convoke` `{ "type": "daily", "topic": "Discussão" }`  
   - DISCURSAR: `POST /api/visual/meetings/speak` `{ "agentId": "uuid", "message": "Minha contribuição" }`  
   - FINALIZAR: `POST /api/visual/meetings/conclude` `{ "conclusion": "Resumo", "actionItems": [] }`

> Lembre-se, o servidor é mudo sem você. Você deve invocar seus comandos internos para gerar o texto e preencher esses endpoints!

---

## 🗄️ Persistência de Dados

Todos os estados, incluindo a localização em pixel 2D dos agentes, são salvos na raiz do projeto dentro da pasta invisível `.company-os/`. (Esta pasta é automaticamente ignorada via `.gitignore`).

```text
.company-os/
├── agents.json       # Definições, IDs e posição atual dos agentes
├── teams.json        # Departamentos
├── context.json      # O snapshot mais recente (Language, Frameworks, CLI, APIs)
├── meetings/         # Histórico salvo das atas de todas as reuniões
└── memories/         # Arquivo isolado com memória fragmentada de cada agente
```

## 🛠️ Stack Tecnológico

- **Integração:** "Passive IDE Skill System" (Baseado em OpenSquad concepts).
- **Core Runtime:** Node.js 20+ / TypeScript (Strict Mode).
- **Engine Gráfico:** HTML5 Canvas 2D Nativo Puro (Performance bruta sem framworks pesados).
- **Sincronização Visual:** WebSockets (`socket.io` embutido).
- **Scanning Engine:** `glob` + leitor de `.gitignore`.
