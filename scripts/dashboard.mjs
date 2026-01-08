// Console dashboard for local stack checks (API + Web).
// Uses Node 18+ global fetch and reads VITE_API_BASE_URL/WEB_URL.

const apiBase = process.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const apiHealth = apiBase.endsWith('/health') ? apiBase : `${apiBase.replace(/\/$/, '')}/health`;
const webUrl = process.env.WEB_URL || 'http://localhost:4173';

async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 2500);
  try {
    const res = await fetch(url, { signal: controller.signal, method: options.method || 'GET' });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    return null;
  }
}

async function checkApi() {
  const res = await safeFetch(apiHealth);
  if (!res || !res.ok) return { up: false };
  const data = await res.json().catch(() => ({}));
  return {
    up: true,
    uptime: typeof data.uptime === 'number' ? Math.round(data.uptime) : undefined,
    db: data.db || undefined,
  };
}

async function checkWeb() {
  const res = await safeFetch(webUrl);
  if (!res) return { up: false };
  return { up: res.ok };
}

function line(label, value) {
  return `- ${label}: ${value}`;
}

(async () => {
  const [api, web] = await Promise.all([checkApi(), checkWeb()]);

  console.log('MERN Project Dashboard');
  console.log(line('API Base', apiBase));
  console.log(line('Web', webUrl));
  console.log('');

  console.log(line('API Status', api.up ? 'UP' : 'DOWN'));
  if (api.up) {
    if (api.uptime !== undefined) console.log(line('API Uptime', `${api.uptime}s`));
    if (api.db) {
      const dbText = typeof api.db.status === 'string' ? api.db.status : String(api.db.state);
      console.log(line('DB', dbText));
    }
  }
  console.log(line('Web Status', web.up ? 'UP' : 'DOWN'));

  console.log('\nTips:');
  console.log(line('Health URL', apiHealth));
  console.log(line('Open Frontend', webUrl));
})();
