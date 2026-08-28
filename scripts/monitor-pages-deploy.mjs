import { spawn } from 'node:child_process';

async function getGitToken() {
  return new Promise((resolve) => {
    const proc = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('close', () => {
      const lines = out.split(/\r?\n/);
      let token = '';
      for (const line of lines) {
        if (line.startsWith('password=')) token = line.slice(9).trim();
      }
      resolve(token);
    });
    proc.stdin.write('protocol=https\nhost=github.com\n\n');
    proc.stdin.end();
  });
}

async function monitorPages() {
  const token = await getGitToken();
  const repo = 'Dtcsrni/EvaluaPro_Sistema_Universitario';
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': 'Bearer ' + token,
    'User-Agent': 'EvaluaPro-Release-Agent',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  console.log('[Pages Deploy] Esperando el despliegue en GitHub Pages...');
  for (let i = 1; i <= 15; i++) {
    const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=6`, { headers });
    const runsData = await runsRes.json();
    if (runsData.workflow_runs) {
      const pagesRun = runsData.workflow_runs.find(r => r.name.includes('Marketing Site') || r.name.includes('pages-build-deployment'));
      if (pagesRun) {
        console.log(`Intento ${i}: Workflow '${pagesRun.name}' -> Status: ${pagesRun.status}, Conclusion: ${pagesRun.conclusion || 'en ejecución'}`);
        if (pagesRun.status === 'completed' && pagesRun.conclusion === 'success') {
          console.log('\n🎉 ¡DESPLIEGUE EN GITHUB PAGES COMPLETADO EXITOSAMENTE!');
          console.log('URL pública:', 'https://dtcsrni.github.io/EvaluaPro_Sistema_Universitario/');
          return;
        }
      }
    }
    await new Promise(r => setTimeout(r, 8000));
  }
}

monitorPages().catch(console.error);
