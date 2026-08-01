# Integração WhatsApp (WAHA) — passo a passo

Este guia liga o Orbit ao WhatsApp: sempre que um título Sienge entra em
`1ª / 2ª / 3ª Alçada`, o responsável recebe uma mensagem no celular.

**Quem nunca mexeu em servidor consegue seguir.** Todo comando abaixo é para ser
**colado no terminal do servidor** (explico como abrir esse terminal no Passo 1).

---

## 📍 Estado da instalação atual (agosto/2026)

| Item | Valor |
|---|---|
| Acesso ao servidor | `ssh -p 22022 root@143.95.223.48` |
| Endereço do WAHA | `https://143-95-223-48.sslip.io` |
| Sistema | Ubuntu 22.04.5 · 2 GB RAM · swap de 2 GB ativa |
| Chaves geradas | `/root/.waha-secrets` no servidor (só root lê) |

**Passos já concluídos:** 1 a 5, 7 e 8 — servidor preparado, WAHA no ar com HTTPS
válido, secrets cadastrados no Supabase e gatilho do banco ligado.

**Falta fazer:** Passo 6 (escanear o QR com o número dedicado) e Passo 9 (ligar a
chave em Configurações → WhatsApp e cadastrar os telefones).

> Sobre o endereço: como não havia domínio próprio disponível, usamos o
> **sslip.io**, que resolve qualquer IP automaticamente sem cadastro. Se um dia a
> VPS trocar de IP, o endereço muda junto — basta rodar o Certbot de novo com o
> novo nome. Migrar para um domínio da empresa depois é só repetir o Passo 5.

---

## Antes de começar, tenha em mãos

| O que | Onde consegue |
|---|---|
| IP da VPS + senha de root + **porta SSH** | E-mail da Hostgator após a contratação |
| Um subdomínio livre (ex.: `waha.uchoaempreendimentos.com.br`) | Painel do seu domínio |
| Um chip/número de WhatsApp **dedicado** | Loja de celular — **não use o número pessoal de ninguém** |

> ⚠️ **Por que um número dedicado?** O WAHA se conecta pelo WhatsApp Web, que
> não é a API oficial da Meta. Existe risco real de o número ser banido. Se isso
> acontecer com um número dedicado, você troca o chip e segue a vida.

Conceito rápido: o **WAHA** é um programa que fica ligado 24h no servidor,
conectado ao WhatsApp daquele número, e que recebe ordens do Orbit pela internet
("mande esta mensagem para tal pessoa").

---

## Passo 1 — Entrar no servidor

Aqui é onde você vai colar todos os comandos dos próximos passos.

No **seu computador** (Windows), abra o PowerShell e digite:

```
ssh -p 22022 root@143.95.223.48
```

Ele vai pedir a senha de root — digite (a senha **não aparece na tela** enquanto
você digita, isso é normal) e dê Enter.

> ⚠️ **A porta 22022 não é opcional.** A Hostgator não usa a porta 22 padrão do
> SSH. Sem o `-p 22022`, o erro é `Connection refused`. Se algum dia esse erro
> voltar, confirme a porta no painel da Hostgator.

Quando aparecer algo como `root@srv123:~#`, você está dentro do servidor.
**É nessa tela preta que todos os comandos abaixo devem ser colados.**

> 💡 Para colar no terminal SSH, use **botão direito do mouse** (Ctrl+V às vezes
> não funciona).

---

## Passo 2 — Preparar o servidor

Cole este bloco inteiro de uma vez e dê Enter. Ele cria uma "memória extra"
(swap) — necessária porque a VPS tem só 2 GB de RAM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Agora instale o Docker (o programa que roda o WAHA). Pode demorar 1-2 minutos:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Confira se deu certo:

```bash
docker --version
```

Deve aparecer algo como `Docker version 27.x.x`. Se aparecer "command not found",
o Docker não instalou — rode o comando de instalação de novo.

Por fim, o firewall (deixa passar só o acesso SSH e o site seguro):

```bash
sudo ufw allow 22022/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

> 🚨 **Preste atenção na porta 22022 aqui.** É a porta pela qual você está
> conectado neste exato momento. Se liberar a 22 (a padrão) por engano e ativar o
> firewall, sua conexão cai e **você fica trancado para fora do servidor** —
> só recuperando pelo console de emergência do painel da Hostgator.
>
> Confirme que ficou certo antes de encerrar a sessão:
>
> ```bash
> sudo ufw status
> ```
>
> Tem que aparecer `22022/tcp ALLOW`. **Não feche este terminal** até abrir uma
> segunda janela do PowerShell e confirmar que consegue conectar de novo.
>
> A porta 80 entra na lista porque o Certbot (Passo 5) a usa para provar que o
> domínio é seu. Sem ela, a emissão do certificado falha.

---

## Passo 3 — Criar a chave de segurança do WAHA

O WAHA precisa de uma senha própria para que só o Orbit consiga mandar mensagens.
Gere uma agora:

```bash
openssl rand -hex 24
```

Vai aparecer uma sequência tipo `a3f9c2...`. **Copie e guarde num bloco de notas** —
vamos chamá-la de `CHAVE_WAHA` e ela será usada em dois lugares diferentes.

Aproveite e gere a segunda chave, que o Supabase usará para falar com a função:

```bash
openssl rand -hex 32
```

Guarde também — vamos chamá-la de `TOKEN_DISPARO`.

---

## Passo 4 — Subir o WAHA

Crie a pasta e abra o editor de texto do servidor:

```bash
sudo mkdir -p /opt/waha
sudo nano /opt/waha/docker-compose.yml
```

A tela vai ficar quase toda vazia — esse é o editor **nano**. Cole o conteúdo
abaixo, **trocando `COLE_AQUI_A_CHAVE_WAHA`** pela primeira chave que você guardou:

```yaml
services:
  waha:
    image: devlikeapro/waha
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./sessions:/app/.sessions
    environment:
      WHATSAPP_DEFAULT_ENGINE: NOWEB
      WHATSAPP_API_KEY: "COLE_AQUI_A_CHAVE_WAHA"
      WHATSAPP_RESTART_ALL_SESSIONS: "True"
```

Para **salvar e sair do nano**: `Ctrl+O` → Enter → `Ctrl+X`.

Agora ligue o WAHA:

```bash
cd /opt/waha
sudo docker compose up -d
```

Verifique se está rodando:

```bash
sudo docker ps
```

Deve aparecer uma linha com `devlikeapro/waha` e o status `Up`.

> 📌 Repare no `127.0.0.1:3000` do arquivo: isso faz o WAHA aceitar conexões só
> de dentro do próprio servidor. Quem vai publicá-lo na internet, de forma
> segura, é o Passo 5.

---

## Passo 5 — Publicar com HTTPS

**Antes deste passo**, vá ao painel do seu domínio e crie um registro do tipo **A**
apontando `waha` para o IP da VPS. Espere uns minutos para propagar.

De volta ao terminal do servidor:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Crie a configuração do site:

```bash
sudo nano /etc/nginx/sites-available/waha
```

Cole isto, trocando o endereço pelo **seu** subdomínio:

```nginx
server {
    listen 80;
    server_name waha.seudominio.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Salve (`Ctrl+O`, Enter, `Ctrl+X`) e ative:

```bash
sudo ln -s /etc/nginx/sites-available/waha /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Se o `nginx -t` disser `syntax is ok` e `test is successful`, siga. Agora o
certificado HTTPS (troque pelo seu subdomínio):

```bash
sudo certbot --nginx -d waha.seudominio.com.br
```

Ele vai pedir um e-mail e perguntar se aceita os termos — responda e aceite.
Quando terminar, abra `https://waha.seudominio.com.br` no navegador: deve carregar
sem aviso de "site não seguro".

---

## Passo 6 — Conectar o número de WhatsApp

1. Acesse `https://waha.seudominio.com.br/dashboard` no navegador.
2. Faça login usando a `CHAVE_WAHA` quando ele pedir a API key.
3. Crie uma sessão chamada **`default`**.
4. Vai aparecer um **QR Code**. No celular do número dedicado, abra o WhatsApp →
   **Aparelhos conectados** → **Conectar aparelho** → escaneie o QR.
5. A sessão deve mudar para o status **WORKING**.

> 🔋 Mantenha esse celular ligado e com internet. Se ele ficar muito tempo
> offline, a sessão cai e você precisa escanear o QR de novo.

---

## Passo 7 — Configurar o Supabase

Agora saímos do servidor. Estes comandos rodam **no seu computador**, na pasta do
projeto TaskManeger (PowerShell), com o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado.

Cadastre as chaves (troque os valores pelos seus):

```bash
supabase secrets set WAHA_BASE_URL=https://waha.seudominio.com.br
supabase secrets set WAHA_API_KEY=<a CHAVE_WAHA do Passo 3>
supabase secrets set WAHA_SESSION=default
supabase secrets set WHATSAPP_DISPATCH_TOKEN=<o TOKEN_DISPARO do Passo 3>
supabase secrets set APP_URL=https://seu-orbit.vercel.app
```

Depois publique a função que faz a retentativa automática:

```bash
supabase functions deploy process-routines
```

> As funções `send-whatsapp` e `admin-users` **já estão publicadas** — não
> precisa mexer nelas.

---

## Passo 8 — Ligar o gatilho no banco

O banco precisa saber para onde avisar. Isso é feito **uma única vez**, no
[SQL Editor do painel do Supabase](https://supabase.com/dashboard) (menu lateral →
**SQL Editor** → **New query**).

Cole, troque os dois valores e clique em **Run**:

```sql
update public.whatsapp_dispatch_secrets
set function_url   = 'https://quyoeoftqackmrjxpreb.supabase.co/functions/v1/send-whatsapp',
    dispatch_token = 'COLE_AQUI_O_TOKEN_DISPARO',
    updated_at     = now()
where id = 'default';
```

(O `function_url` acima já está com o endereço correto do seu projeto — só troque
o token.)

---

## Passo 9 — Ativar no Orbit

Entre no Orbit com uma conta **administradora** e vá em **Configurações**:

1. Aba **WhatsApp** → preencha a URL (`https://waha.seudominio.com.br`), deixe a
   sessão como `default`, **ligue a chave** e clique em Salvar.
2. Aba **Usuários** → cadastre o telefone de cada pessoa responsável por alçada.

Pronto. Quem não tiver telefone cadastrado continua recebendo só a notificação
interna — nada quebra.

---

## Passo 10 — Testar

No Kanban do Sienge, mova um título para **1ª Alçada**. Em poucos segundos o
responsável deve receber a mensagem no WhatsApp.

Se não chegar, vá em **Configurações → WhatsApp → Últimos envios**: ali aparece o
status de cada mensagem e o erro, se houver.

---

## Quando algo der errado

| O que você vê | O que provavelmente é | Como resolver |
|---|---|---|
| Nada aparece em "Últimos envios" | A integração está desligada, ou a pessoa não tem telefone cadastrado | Conferir o Passo 9 |
| Fica em **"Na fila"** para sempre | O Passo 8 não foi feito | Rodar o `update` do Passo 8 |
| **"Falhou"** com erro 401 | A `CHAVE_WAHA` do compose e a do `supabase secrets` estão diferentes | Refazer o Passo 7 com a chave certa |
| **"Falhou"** com erro 422 | A sessão do WhatsApp caiu | Reescanear o QR (Passo 6) |
| O site do WAHA não abre | Nginx ou DNS | `sudo systemctl status nginx` no servidor |

Comandos úteis no servidor:

```bash
sudo docker ps                      # o WAHA está de pé?
sudo docker logs waha-waha-1 --tail 50   # o que ele registrou
cd /opt/waha && sudo docker compose restart   # reiniciar
```

---

## Como funciona por dentro (referência)

```
Kanban Sienge → INSERT em notifications (type = alcada_pending)
                  ↓ trigger enqueue_whatsapp_notification (pg_net)
              whatsapp_outbox → Edge Function send-whatsapp → WAHA (VPS) → WhatsApp
                  ↑ cron do process-routines reprocessa o que falhou (a cada 15 min)
```

O disparo acontece no banco, e não no navegador, para que a mensagem saia mesmo
se quem moveu o título fechar o Orbit logo em seguida.

As chaves ficam separadas de propósito:

- `whatsapp_config` — URL, sessão e liga/desliga. Editável pelo admin na tela.
- `whatsapp_dispatch_secrets` — `function_url` e `dispatch_token`. Tabela com RLS
  e **sem nenhuma policy**: nem o app consegue ler.
- Secrets da Edge Function — `WAHA_API_KEY` e afins. Nunca chegam ao navegador.

Consulta direta à fila, se precisar:

```sql
select status, attempts, last_error, created_at
from whatsapp_outbox order by created_at desc limit 20;
```
