# 500 Perguntas de Amor - Jose & Rita - Setup Guide

## 1. Criar Projeto Firebase (GRATIS)

### Passo 1: Aceder ao Firebase
1. Vai a [https://console.firebase.google.com](https://console.firebase.google.com)
2. Faz login com a tua conta Google
3. Clica em **"Criar um projeto"** (ou "Add project")

### Passo 2: Configurar o Projeto
1. Nome do projeto: `perguntas-amor` (ou qualquer nome)
2. Desativa o Google Analytics (nao e necessario)
3. Clica **"Criar projeto"**
4. Aguarda a criacao e clica **"Continuar"**

### Passo 3: Adicionar App Web
1. No dashboard do projeto, clica no icone **</> (Web)**
2. Nome da app: `perguntas-amor`
3. **NAO** marques "Firebase Hosting" (vamos usar GitHub Pages)
4. Clica **"Registar app"**
5. Vai aparecer um bloco de codigo com `firebaseConfig` - **COPIA estes valores!**

### Passo 4: Colar a Config no Codigo
1. Abre o ficheiro `app.js`
2. No topo do ficheiro, substitui os valores em `firebaseConfig`:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",           // cola o teu apiKey
    authDomain: "perguntas-amor.firebaseapp.com",
    projectId: "perguntas-amor",
    storageBucket: "perguntas-amor.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc..."
};
```

### Passo 5: Ativar Firestore Database
1. No menu lateral do Firebase, clica em **"Firestore Database"**
2. Clica **"Criar base de dados"** (ou "Create database")
3. Seleciona **"Iniciar em modo de teste"** (Start in test mode)
4. Escolhe a localizacao mais proxima (ex: `europe-west1`)
5. Clica **"Ativar"**

### Passo 6: Regras de Seguranca do Firestore (Opcional)

Depois de testar, podes adicionar regras para proteger os dados.
No Firebase Console > Firestore > **Rules**, cola:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura e escrita na colecao "game"
    match /game/{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Nota:** As regras em modo de teste expiram apos 30 dias. Se quiseres manter o jogo ativo mais tempo, usa estas regras acima que permitem acesso permanente. Para o Dia dos Namorados, o modo de teste e suficiente!

---

## 2. Deploy no GitHub Pages

### Passo 1: Criar Repositorio
1. Vai a [https://github.com/new](https://github.com/new)
2. Nome: `perguntas-amor` (ou outro nome)
3. Marca como **Public**
4. Clica **"Create repository"**

### Passo 2: Fazer Upload dos Ficheiros
1. Na pagina do repo, clica **"uploading an existing file"**
2. Arrasta todos os ficheiros do projeto:
   - `index.html`
   - `style.css`
   - `app.js`
   - `questions.js`
   - `manifest.json`
3. Clica **"Commit changes"**

### Passo 3: Ativar GitHub Pages
1. Vai a **Settings** > **Pages**
2. Em "Source", seleciona **"Deploy from a branch"**
3. Branch: **main** | Folder: **/ (root)**
4. Clica **"Save"**
5. Aguarda 1-2 minutos
6. O site vai estar disponivel em: `https://SEU_USERNAME.github.io/perguntas-amor/`

---

## 3. Partilhar com a Rita

1. Envia o link do site para a Rita
2. Ela abre no telemovel (iPhone/Android)
3. Pode adicionar ao ecra inicial:
   - **iPhone**: Safari > Partilhar > "Adicionar ao Ecra Inicial"
   - **Android**: Chrome > Menu (3 pontos) > "Adicionar ao ecra inicial"
4. Fica como uma app nativa no telemovel!

---

## Como Funciona

### Fase 1: Responder (cada um responde sozinho)
1. Cada pessoa seleciona o seu nome (Jose ou Rita)
2. Na primeira vez, cria um PIN de 4 digitos (fica como senha)
3. Nas vezes seguintes, usa o PIN para entrar
4. Respondem as 500 perguntas ao seu ritmo
5. O progresso e guardado automaticamente no Firebase
6. **Ninguem ve as respostas do outro!**

### Fase 2: Adivinhar (so desbloqueia quando ambos terminarem)
1. Quando **ambos** terminarem as 500 perguntas, o "Modo Adivinhar" desbloqueia
2. Cada um tenta adivinhar o que o/a parceiro/a respondeu
3. Estilo "Family Feud" - revela a resposta correta com animacao
4. No final, ve a percentagem de acertos!

### Resultados
- A qualquer momento, podem ver os resultados na secao de Resultados
- Mostra respostas iguais e diferentes
- Calcula a percentagem de compatibilidade

### Reset para Testes
- Dentro da app, em **Opcoes avancadas**, podes apagar todas as tuas respostas
- Isto permite testar o jogo do zero

---

## Estrutura dos Ficheiros

```
/
├── index.html       -> Pagina principal (todas as telas)
├── style.css        -> Estilos e tema Valentine's Day
├── app.js           -> Logica do jogo + Firebase + autenticacao PIN
├── questions.js     -> 500 perguntas organizadas por categorias
├── manifest.json    -> Configuracao PWA (app no telemovel)
└── SETUP.md         -> Este ficheiro de instrucoes
```

---

## Resolucao de Problemas

**"As respostas nao guardam"**
- Verifica se colaste a config do Firebase corretamente no `app.js`
- Verifica se ativaste o Firestore no Firebase Console
- Se nao funcionar, a app usa localStorage como backup (mas so funciona por dispositivo)

**"A Rita nao consegue aceder"**
- Verifica se o repo e Public
- Verifica se o GitHub Pages esta ativo
- O link correto e: `https://USERNAME.github.io/REPO_NAME/`

**"Esqueci o PIN"**
- Os PINs sao guardados no Firebase. Para fazer reset:
  1. Vai ao Firebase Console > Firestore
  2. Encontra o documento `game/jose` ou `game/rita`
  3. Apaga o campo `pin`
  4. Na proxima vez que entrares, crias um novo PIN

**"O Modo Adivinhar nao desbloqueia"**
- Ambos (Jose E Rita) precisam de ter todas as 500 perguntas respondidas
- Verifica o progresso de cada um no dashboard

**"Quero mudar perguntas"**
- Edita o ficheiro `questions.js`
- Cada pergunta tem: id, cat (categoria 0-9), text, type, options
- Tipos: `thisorthat` (2 opcoes), `choice` (3-4 opcoes), `scale` (1-10), `text` (resposta livre)
