import 'dotenv/config';

// Configurações do Sienge
const SIENGE_SUBDOMAIN = process.env.SIENGE_SUBDOMAIN; // ex: minha-empresa
const SIENGE_USER = process.env.SIENGE_USER;
const SIENGE_PASSWORD = process.env.SIENGE_PASSWORD; // Senha ou Token da API

// A URL pública da nossa Edge Function no Supabase que criamos
const WEBHOOK_URL = 'https://quyoeoftqackmrjxpreb.supabase.co/functions/v1/sienge-webhook';
// O Token secreto que o Sienge vai nos mandar de volta para provar que é ele
const WEBHOOK_TOKEN = process.env.SIENGE_WEBHOOK_TOKEN || 'sienge-taskmanager-secret-token';

const EVENTS_TO_SUBSCRIBE = [
  "PAYMENT_AUTHORIZATION_UPDATE",
  "PAYMENT_AUTHORIZATION_AVAILABLE"
];

async function registerWebhook() {
  if (!SIENGE_SUBDOMAIN || !SIENGE_USER || !SIENGE_PASSWORD) {
    console.error('ERRO: Faltam credenciais do Sienge no arquivo .env');
    console.error('Certifique-se de ter configurado SIENGE_SUBDOMAIN, SIENGE_USER e SIENGE_PASSWORD');
    process.exit(1);
  }

  const credentials = Buffer.from(`${SIENGE_USER}:${SIENGE_PASSWORD}`).toString('base64');
  const apiUrl = `https://api.sienge.com.br/${SIENGE_SUBDOMAIN}/public/api/v1/hooks`;

  console.log(`📡 Registrando WebHook no Sienge (${SIENGE_SUBDOMAIN})...`);
  console.log(`URL de Destino: ${WEBHOOK_URL}`);
  console.log(`Eventos: ${EVENTS_TO_SUBSCRIBE.join(', ')}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        token: WEBHOOK_TOKEN,
        events: EVENTS_TO_SUBSCRIBE
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('\n❌ Falha ao registrar WebHook:');
      console.error(JSON.stringify(data, null, 2));
      return;
    }

    console.log('\n✅ WebHook Registrado com Sucesso!');
    console.log('ID do WebHook:', data.id);
    console.log('Eventos cadastrados:', data.events);
    
  } catch (error) {
    console.error('\n❌ Erro de conexão:', error.message);
  }
}

registerWebhook();
