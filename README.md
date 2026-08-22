# Provador Virtual IA — Virtual Try-On Platform

Plataforma completa de Provador Virtual (Virtual Try-On — VTON) com Inteligência Artificial para moda, ateliês e e-commerce, desenvolvida com React Native e Expo.

---

## 1. Arquitetura Geral do Sistema

O sistema foi concebido sob uma arquitetura **B2B Multi-tenant** de alta escalabilidade e segurança, separando rigidamente o catálogo visual comercial do pipeline de geração de provador virtual por inteligência artificial.

```
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND (Mobile & Web)                     │
│  React Native / Expo + Lucide Icons + Multi-idioma          │
│  - Expo + React Native para plataforma unificada            │
│  - Expo Web somente para preview no AI Studio               │
│  - Android / iOS via Expo / EAS Build                       │
│  - Provador Virtual Interativo                              │
│  - Catálogo de Produtos & Detalhes                          │
│  - Painel de Gestão & Vault de Credenciais de IA            │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON (JWT Auth)
┌──────────────────────────────▼──────────────────────────────┐
│                  BACKEND (Node.js / Express)                │
│                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │   Catalog & Stores    │      │  Store Credential      │  │
│  │   Service (Multi-ten) │      │  Vault (AES Encrypted) │  │
│  └───────────┬───────────┘      └───────────┬────────────┘  │
│              │                              │               │
│  ┌───────────▼───────────┐      ┌───────────▼────────────┐  │
│  │ Garment Preparation   │◄────►│  Try-On Engine &       │  │
│  │ Pipeline (Gemini AI)  │      │  Provider Registry     │  │
│  └───────────┬───────────┘      └───────────┬────────────┘  │
│              │                              │               │
│              ▼                              ▼               │
│      [Quality Gate Engine]          [Semantic Validator]    │
│      - Isolation Verification       - SHA-256 Collision     │
│      - Status Hierarchy: READY      - src/ref Mapping       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
    ┌────────────────────┐          ┌────────────────────┐
    │  Google Gemini AI  │          │  Perfect Corp API  │
    │  (Flash / Lite)    │          │  (AI Clothes VTON) │
    └────────────────────┘          └────────────────────┘
```

---

## 2. Stack Técnica e Plataformas

- **Frontend Mobile & Web:**
  - **Framework:** React Native + Expo (SDK 52+)
  - **Expo Web:** Utilizado exclusivamente para live preview no ambiente AI Studio
  - **Mobile Nativo:** Suporte total para Android (.apk/.aab) e iOS (.ipa) via Expo / EAS Build
  - **Estilização e Componentes:** Tailwind CSS, Lucide Icons, React Native Animated
- **Backend:** Node.js (v20+), TypeScript, Express 4.x
- **Inteligência Artificial (Garment Preparation & VTON):**
  - Google Gemini Image Models (`gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3.7-flash`) via `@google/genai`
  - Perfect Corp AI Fashion API (VTON Enterprise)
- **Armazenamento de Mídia:** Storage Service com suporte a Supabase Storage (S3-compatible) e Local Disk Fallback
- **Criptografia & Segurança:** AES-256-GCM para chaves de API por loja, validação criptográfica SHA-256 para integridade de imagens

---

## 3. Papel do Garment Preparation e Por Que Ele É Obrigatório

### A Regra Fundamental
> **Foto de Catálogo $\neq$ Referência de Provador (`try_on_reference`)**

Fotos de catálogo comerciais frequentemente contêm:
1. Modelos humanos em poses dinâmicas ou com partes do corpo sobre a roupa
2. Cenários complexos (fundos de estúdio, natureza, iluminação artística)
3. Múltiplas peças (ex: modelo vestindo calça, blusa e casaco juntos)

Se uma foto de catálogo com modelo for enviada diretamente como referência de roupa para motores de Virtual Try-On, ocorrerá o defeito crítico de **duplicação de pessoa** (o motor tenta vestir o modelo da foto sobre a pessoa original).

### O Pipeline de Preparação Automática
O `GarmentPreparationService` executa as seguintes etapas:
1. **Análise Visual Heurística & Multimodal:** Identifica presença de modelo humano, manequim, complexidade do fundo e categoria da peça.
2. **Isolamento e Limpeza (Gemini Flash Image):** Gera uma nova imagem contendo **apenas** a peça de vestuário isolada, em fundo neutro e plano.
3. **Quality Gate Estrito:** Valida conformidade das dimensões, preservação de textura/cores e ausência total de partes humanas.
4. **Persistência Imutável:** Salva o resultado como entidade separada (`type: 'try_on_reference'`) sem alterar a foto original do catálogo.
5. **Zero Fallback:** Se a IA não conseguir isolar a peça, o sistema **NUNCA** copia a foto do catálogo como referência. O status torna-se `failed` ou `not_configured`, bloqueando o provador de forma segura.

---

## 4. Hierarquia de Status e Bloqueio do Provador

O sistema opera sob uma hierarquia estrita de 4 estados para preparação de peças:

| Status | Significado | Ação no Provador | Quality Gate `passed` |
| :--- | :--- | :--- | :--- |
| `ready` | Peça tratada, isolada e aprovada pelo Quality Gate | **Liberado** | `true` |
| `needs_review` | Imagem gerada, porém com ressalva visual que exige revisão manual | **Bloqueado** | `false` |
| `failed` | Preparação não produziu imagem válida | **Bloqueado** | `false` |
| `not_configured` | Motor de IA não configurado para a loja | **Bloqueado** | `false` |

> **Garantia:** Se o status for `needs_review`, a interface exibe:  
> *"Esta peça precisa ser revisada antes de ser usada no provador."*  
> O backend rejeita a execução com HTTP 422 (`GARMENT_NEEDS_REVIEW`) e nunca invoca os provedores de IA.

---

## 5. Fluxo de Execução do Virtual Try-On

1. **Seleção da Peça:** Usuário escolhe a peça desejada no catálogo da loja.
2. **Foto do Usuário (Pessoa):** Usuário tira ou envia uma foto sua. A validação não-bloqueante aceita a foto com dicas de iluminação.
3. **Resolução da Referência:** O backend busca o `try_on_reference` aprovado (`status: 'ready'`). Se inexistente, aciona o pipeline de preparação on-demand.
4. **Validação Semântica & Diagnóstico SHA-256:**
   - Garante que a foto da pessoa e a foto da roupa possuem hashes SHA-256 distintos.
   - Aplica mapeamento estrito: `src_file_url = PERSON`, `ref_file_url = PREPARED GARMENT`.
5. **Execução Multi-Provider Concorrente:** Dispara a geração via `Promise.allSettled` para os provedores configurados no vault da loja (`perfectcorp`, `google`).
6. **Exibição do Resultado:** A interface apresenta o comparativo antes/depois com controles de download e compartilhamento.

---

## 6. Autenticação e Isolamento Multi-Tenant

- Cada loja (`storeId`) possui seu catálogo isolado, histórico de provador e cofre de credenciais (`StoreCredentialService`).
- As chaves de API dos provedores de IA (Google, Perfect Corp) são armazenadas individualmente por loja com criptografia segura.
- Produtos de uma loja nunca podem ser acessados ou alterados por outra loja (`STORE_MISMATCH`).

---

## 7. Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```env
# Servidor
PORT=3000
NODE_ENV=development
JWT_SECRET=<your-secret-here>

# Google Gemini AI (Garment Preparation & VTON)
# O backend aceita GOOGLE_API_KEY ou GEMINI_API_KEY
GOOGLE_API_KEY=<your-google-api-key>
# GEMINI_API_KEY=<your-gemini-api-key>

# Perfect Corp AI Fashion API (Opcional por Loja)
PERFECTCORP_API_KEY=<your-perfectcorp-api-key>
PERFECTCORP_API_HOST=https://yce-api-01.makeupar.com

# Supabase Storage (Opcional - fallback automático para disco local)
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>

# Mobile App Public Configuration (Expo / Client)
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 8. Scripts de Desenvolvimento e Testes

```bash
# Instalar dependências
npm install

# Iniciar servidor em desenvolvimento (Full-stack)
npm run dev

# Checar tipagem TypeScript sem emitir arquivos
npx tsc --noEmit

# Executar suite completa de testes
npm test

# Executar suite de aceitação da referência e Quality Gate (Fase 7.7)
npx tsx server/tests/phase7_7_acceptance.test.ts

# Build de produção
npm run build
```
