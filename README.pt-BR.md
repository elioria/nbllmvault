# 🧠 nbllmvault

**Idiomas:** [English](README.md) · [Português (BR)](README.pt-BR.md)

Um **clone aberto e local-first do Google NotebookLM**, construído sobre o motor
open-source [SwarmVault](https://github.com/swarmclawai/swarmvault).

Importe conteúdo de várias fontes (PDFs, DOCX, URLs, arXiv, YouTube, notas,
código, e-mail — mais de 30 formatos), **compile** tudo num wiki Markdown
interligado + um grafo de conhecimento e então **faça perguntas fundamentadas**
com citações — tudo local-first e offline por padrão.

> ### ⭐ Principal vantagem sobre o NotebookLM: os dados são seus
> Um clique exporta o caderno **inteiro** — as fontes originais, o wiki
> compilado e o grafo de conhecimento — em formatos abertos **Markdown + JSON**:
> vault completo, vault Obsidian, um pacote de IA para qualquer LLM, ou o grafo
> bruto. Sem conta, sem aprisionamento na nuvem, sem formato proprietário.
> Apague este app amanhã e o seu conhecimento sobrevive como arquivos que você
> pode ler, editar, pesquisar e reimportar em qualquer lugar.

- **Frontend** — React 19 · Vite 7.3 · Tailwind v4 · shadcn/ui (layout de 3 painéis estilo NotebookLM)
- **Backend** — Hono, uma fina camada HTTP sobre o `@swarmvaultai/engine`
- **Motor** — o SwarmVault faz o trabalho pesado: extração, compilação, RAG, grafo, busca

Veja **[DOCS.md](DOCS.md)** para o aprofundamento: implementação, prós/contras
completos versus o NotebookLM e roadmap.

---

## Índice

- [O que ele faz](#o-que-ele-faz)
- [Equivalência com o NotebookLM](#equivalência-com-o-notebooklm)
- [Por que importa — propriedade dos dados](#por-que-importa--propriedade-dos-dados)
- [Prós e contras vs Google NotebookLM](#prós-e-contras-vs-google-notebooklm)
- [Arquitetura](#arquitetura)
- [O pipeline](#o-pipeline)
- [Início rápido](#início-rápido)
- [Provedores](#provedores)
- [Formatos de exportação](#formatos-de-exportação)
- [Superfície da API](#superfície-da-api)
- [Testes](#testes)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Licença](#licença)

---

## O que ele faz

O NotebookLM permite enviar fontes, organiza-as automaticamente e responde
perguntas fundamentadas nessas fontes. O nbllmvault faz o mesmo — **importar →
compilar → perguntar** — mas toda a base de conhecimento são arquivos simples em
disco, totalmente seus.

| Recurso | Como |
|---|---|
| **Importação multiformato** | arquivos (PDF, DOCX, XLSX, PPTX, EPUB, CSV, MD, código, áudio, e-mail, …) + URLs + texto colado |
| **Captura inteligente de URL** | arXiv / DOI / tweet / artigo (Readability) / transcrição do YouTube |
| **Compilação para wiki** | páginas de conceito / entidade / fonte / insight, painéis, resumos de comunidade |
| **Grafo de conhecimento** | nós e arestas tipados, comunidades, "god-nodes", detecção de contradições |
| **Chat fundamentado (RAG)** | respostas citam as páginas-fonte; sessões com múltiplos turnos |
| **Busca híbrida** | full-text SQLite + embeddings opcionais, fusão por reciprocal-rank |
| **Navegação por wikilinks** | links `[[página]]` resolvem e são clicáveis no leitor |
| **Exportação total dos dados** | vault completo · wiki · Obsidian · pacote de IA · grafo JSON |

---

## Equivalência com o NotebookLM

| NotebookLM | nbllmvault |
|---|---|
| Caderno (notebook) | Um **vault** SwarmVault (um diretório por caderno) |
| Fontes | `ingestInput` (arquivos) / `addInput` (URLs, captura inteligente) |
| Guia / notas do caderno | **Páginas wiki** compiladas (`compileVault`) ligadas por `[[wikilinks]]` |
| Chat (perguntas fundamentadas) | `askChatSession` — RAG sobre o wiki compilado, com citações |
| (extra) Grafo de conhecimento | `state/graph.json` — conceitos, entidades, comunidades |

---

## Por que importa — propriedade dos dados

O NotebookLM mantém o seu caderno compilado **dentro do Google**. Você consegue
lê-lo na interface deles, mas não consegue extrair o *resultado organizado* — as
notas, a estrutura, o grafo — num formato aberto e utilizável. O nbllmvault é o
oposto: o resultado organizado são apenas arquivos, e um clique os entrega a você.

```
data/vaults/<idDoCaderno>/
├── swarmvault.config.json   configuração do vault
├── swarmvault.schema.md     como o wiki é estruturado
├── raw/                     cópias imutáveis de cada fonte importada
├── wiki/                    a base de conhecimento em markdown ([[wikilinks]])
└── state/                   graph.json + índice de busca + sessões de chat
```

Tudo é seu, no seu disco, em formatos abertos. Veja
[Formatos de exportação](#formatos-de-exportação).

---

## Prós e contras vs Google NotebookLM

### Onde o nbllmvault ganha

| Dimensão | nbllmvault | NotebookLM |
|---|---|---|
| **Propriedade dos dados** | ✅ Arquivos no seu disco; exportação total em formatos abertos | ❌ Preso na nuvem do Google; sem exportação estruturada |
| **Uso offline** | ✅ Funciona 100% offline (provedor heurístico) | ❌ Exige conta Google + internet |
| **Privacidade** | ✅ Fontes nunca saem da sua máquina (modo offline) | ❌ Enviadas para o Google |
| **Formatos abertos** | ✅ Markdown + JSON puros, compatível com Obsidian | ❌ Representação interna proprietária |
| **Grafo de conhecimento** | ✅ Grafo tipado, comunidades, detecção de contradições, exportável | ❌ Não exposto |
| **Extensibilidade** | ✅ Open source, servidor MCP, CLI, scriptável | ❌ Fechado |
| **Auto-hospedagem** | ✅ Sim | ❌ Não |
| **Levar os dados para outras IAs** | ✅ Pacote de IA alimenta qualquer LLM | ❌ Preso aos modelos do Google |

### Onde o NotebookLM ganha (com honestidade)

| Dimensão | NotebookLM | nbllmvault |
|---|---|---|
| **Qualidade da resposta de saída** | ✅ Síntese nível Gemini por padrão | ⚠️ Extrativo offline; precisa de chave para paridade generativa |
| **Audio Overview ("podcast")** | ✅ Recurso símbolo | ❌ Não implementado |
| **Zero configuração** | ✅ Navegador + login Google | ⚠️ Precisa de Node ≥24 + `pnpm install` |
| **Escala / infraestrutura** | ✅ Google processa grandes acervos no servidor | ⚠️ Limitado pela sua máquina |
| **Acabamento & multimodal** | ✅ Produto maduro | ⚠️ UI mais nova; multimodal depende do provedor |

**Resumo:** o NotebookLM é o *produto* mais polido; o nbllmvault é a *ferramenta*
mais soberana. Se você valoriza ter posse dos seus dados, trabalhar
offline/privado, um grafo de conhecimento inspecionável e a liberdade de levar
tudo para qualquer ferramenta ou qualquer IA — o nbllmvault foi feito para isso,
e a **exportação é a prova.**

---

## Arquitetura

```
┌──────────────┐    /api     ┌──────────────┐   chamada de  ┌──────────────────┐
│  React SPA   │ ─────────▶ │   API Hono    │ ──função────▶ │ @swarmvaultai/   │
│ (Vite/TW4)   │ ◀───────── │  (apps/server)│ ◀──────────── │ engine           │
└──────────────┘  JSON/zip   └──────────────┘ dados/arquivos└──────────────────┘
                                     │
                                     ▼
                        data/vaults/<idDoCaderno>/   ← seus arquivos, em disco
```

```
apps/
  server/   API Hono — um caderno == um diretório de vault em data/vaults/<id>
  web/      React + Vite 7.3 + Tailwind v4 + shadcn (proxy /api -> server)
data/       registro notebooks.json + vaults por caderno (no .gitignore)
```

O backend **não contém lógica própria de trabalho de conhecimento** — ele mapeia
rotas HTTP para funções do motor, cada uma identificada pelo `rootDir` do vault.
Um pequeno registro `notebooks.json` guarda id do caderno → nome. Sem banco de dados.

---

## O pipeline

1. **Importar** — arquivos vão para `raw/`, então `ingestInput` extrai o texto
   (30+ formatos via pdfjs, mammoth, Readability, mailparser, …). URLs usam
   `addInput` para captura inteligente (arXiv, DOI, tweet, artigo, YouTube).
2. **Compilar** — `compileVault` extrai conceitos/entidades/afirmações, constrói
   um **grafo de conhecimento** tipado, detecta comunidades, gera **páginas wiki
   em markdown** interligadas e um índice de busca SQLite FTS.
3. **Perguntar** — `askChatSession` executa RAG sobre o wiki compilado e retorna
   uma resposta **com citações** às páginas-fonte.
4. **Exportar** — empacote qualquer parte do vault e baixe.

---

## Início rápido

Requer **Node ≥ 24** e **pnpm**.

```bash
pnpm install
cp .env.example .env        # opcional — funciona 100% offline sem chaves
pnpm dev                    # inicia Hono (:8799) + Vite (:5174)
```

Abra <http://localhost:5174> → **Novo caderno** → adicione fontes →
**Compilar wiki** → faça perguntas.

### Rodar as partes separadamente

```bash
pnpm dev:server   # API Hono em :8799
pnpm dev:web      # servidor Vite em :5174 (proxy /api para :8799)
```

### Build de produção

```bash
pnpm build        # compila o bundle web + o servidor
```

---

## Provedores

- **Sem chave de API** → provedor `heuristic` embutido: extrativo, offline, sem rede.
- **`ANTHROPIC_API_KEY`** → Claude (padrão `claude-opus-4-8`) para síntese.
- **`OPENAI_API_KEY`** → OpenAI (padrão `gpt-4o`).

O provedor é configurado no vault de cada caderno na criação. As chaves ficam no
seu ambiente e nunca são gravadas no vault. Troque o modelo com `NBLLMVAULT_MODEL`.

---

## Formatos de exportação

UI: o menu **Export** dentro de um caderno. API: `GET /api/notebooks/:id/export/:kind`.

| Exportação | Conteúdo | Por quê |
|---|---|---|
| **Vault completo** (`full`) | `raw/` + `wiki/` + `state/` + config | Vault completo e reabrível — `swarmvault next` ou abrir no Obsidian/VS Code. Zero aprisionamento. |
| **Wiki markdown** (`wiki`) | apenas as páginas `wiki/` | Markdown interligado portátil para qualquer editor. |
| **Vault Obsidian** (`obsidian`) | markdown enriquecido com grafo + config `.obsidian/` | Abre direto no Obsidian. |
| **Pacote de IA** (`aipack`) | `llms.txt`, `llms-full.txt`, `graph.jsonld`, por página, manifest | Alimente **o seu** conhecimento em qualquer outro LLM. |
| **Grafo de conhecimento** (`graph`) | `state/graph.json` | Grafo bruto (nós/arestas/comunidades) para suas próprias ferramentas. |

As exportações são montadas em memória (`fflate`) e enviadas ao navegador — nada
sai da sua máquina.

---

## Superfície da API

```
GET    /api/notebooks                       lista cadernos
POST   /api/notebooks                       cria   { name }
GET    /api/notebooks/:id                   detalhe + info do workspace
PATCH  /api/notebooks/:id                   renomeia { name }
DELETE /api/notebooks/:id                   apaga

GET    /api/notebooks/:id/sources           lista fontes
POST   /api/notebooks/:id/sources/file      upload multipart (campo: file)
POST   /api/notebooks/:id/sources/url       { url }   captura inteligente
POST   /api/notebooks/:id/sources/text      { title, text }

POST   /api/notebooks/:id/compile           compila wiki + grafo + índice
GET    /api/notebooks/:id/pages             lista páginas compiladas
GET    /api/notebooks/:id/page?path=...     lê uma página (markdown)
GET    /api/notebooks/:id/search?q=...      busca híbrida FTS
POST   /api/notebooks/:id/chat              { question, sessionId? }  RAG fundamentado

GET    /api/notebooks/:id/export/full       vault completo (.zip) — reabrível no SwarmVault
GET    /api/notebooks/:id/export/wiki       wiki markdown (.zip)
GET    /api/notebooks/:id/export/obsidian   vault Obsidian (.zip)
GET    /api/notebooks/:id/export/aipack     pacote de IA (.zip) — para qualquer LLM
GET    /api/notebooks/:id/export/graph      grafo de conhecimento (.json)
```

---

## Testes

```bash
node node_modules/playwright/cli.js install chromium   # uma vez
pnpm dev                                                # noutro terminal
node apps/web/e2e/smoke.mjs                             # fluxo completo
node apps/web/e2e/export.mjs                            # download de exportação
```

- `smoke.mjs` — criar caderno → adicionar fonte → compilar → abrir página → chat fundamentado.
- `export.mjs` — compilar → abrir menu Export → baixar o vault completo.

---

## Estrutura do projeto

```
apps/server/src/
  config.ts           caminhos, porta, limites
  notebooks.ts        registro de cadernos (notebooks.json) ↔ diretórios de vault
  engine-service.ts   wrappers finos sobre o motor (+ configuração opcional de provedor)
  export-service.ts   ★ exportações de propriedade de dados
  routes.ts           rotas Hono
  index.ts            entrada do servidor (CORS, logger)

apps/web/src/
  lib/api.ts          cliente de API tipado (+ download de exportação)
  views/HomeView.tsx          grade de cadernos
  views/NotebookView.tsx      workspace de 3 painéis + menu Export
  views/panels/SourcesPanel   importação (arquivo/URL/colar) + compilar
  views/panels/ReaderPanel    lista de páginas wiki + leitor markdown + wikilinks
  views/panels/ChatPanel      chat RAG fundamentado com citações
  components/ui/*             primitivos shadcn
```

---

## Licença

MIT. O SwarmVault é licenciado sob MIT pela swarmclawai.
