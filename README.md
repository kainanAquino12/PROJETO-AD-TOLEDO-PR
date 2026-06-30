# Empreendedores do Reino — EDR Toledo/PR

Site institucional do **Empreendedores do Reino (EDR)** com **painel administrativo** para
editar todo o conteúdo (textos, fotos, diretoria, parceiros, pilares, redes sociais) sem mexer no código.

---

## ✅ Como rodar (passo a passo)

1. Tenha o **Node.js** instalado (já está nesta máquina).
2. Abra o terminal **nesta pasta** do projeto.
3. Na primeira vez, instale as dependências:

   ```bash
   npm install
   ```

4. Inicie o site:

   ```bash
   npm start
   ```

5. Abra no navegador:
   - **Site:** http://localhost:3001
   - **Painel:** http://localhost:3001/admin

> Para parar o servidor, pressione **Ctrl + C** no terminal.

> Se a porta 3001 estiver ocupada, rode em outra porta:
> no Windows (PowerShell) → `$env:PORT=3200; npm start`

---

## 🔐 Painel administrativo

- Acesse **http://localhost:3001/admin**
- **Senha padrão:** `edr2024`
- **Troque a senha** assim que entrar, na aba **“Trocar Senha”**.

No painel você edita:

| Aba | O que muda |
|-----|------------|
| **Identidade** | Logo do site, nome, sigla, cidade |
| **Menu** | Itens do menu do topo |
| **Início / Hero** | Títulos, textos, foto principal e a Palavra Pastoral |
| **Encontros** | Fotos da galeria (upload de várias) |
| **Diretoria** | Membros (foto, nome, cargo) |
| **Empresas Parceiras** | Texto e logos das empresas |
| **Pilares** | Ícone, título e descrição de cada pilar |
| **Rodapé** | Textos finais e links das redes sociais |

➡️ Depois de editar, clique em **“Salvar alterações”** (ou pressione **Ctrl + S**).
As mudanças aparecem no site na hora (basta atualizar a página).

### Logo
O site já vem com um logo “ER” desenhado. Para usar a **logo oficial**, vá em
**Identidade → Logo → Enviar imagem** (de preferência PNG com fundo transparente).

---

## 📁 Onde fica o conteúdo

- **`data/content.json`** → todo o texto/estrutura do site (gerado e atualizado pelo painel).
- **`public/uploads/`** → todas as imagens enviadas pelo painel.
- **`data/admin.json`** → senha do painel (criptografada).

> 💾 **Backup:** para guardar uma cópia do site, basta copiar as pastas
> `data/` e `public/uploads/`.

---

## 🧩 Estrutura do projeto

```
server.js              → servidor (Express)
data/content.json      → conteúdo editável do site
views/                 → páginas (index, admin, login) em EJS
  └ partials/          → logo e ícones SVG
public/
  ├ css/               → estilos (site e painel)
  ├ js/                → scripts (site e painel)
  └ uploads/           → imagens enviadas
```

---

## ☁️ Publicar na internet (opcional)

O projeto é um app Node.js comum. Pode ser hospedado em serviços como
**Render**, **Railway**, **Fly.io** ou um VPS. Basta subir os arquivos,
rodar `npm install` e `npm start`. Lembre de definir uma variável de
ambiente `SESSION_SECRET` para mais segurança.

---

Feito com 💙 e dourado para o **Empreendedores do Reino — Toledo/PR**.
