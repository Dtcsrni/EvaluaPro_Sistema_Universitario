import { spawn } from 'node:child_process';

async function getGitToken() {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('close', (code) => {
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

async function main() {
  const token = await getGitToken();
  const repo = 'Dtcsrni/EvaluaPro_Sistema_Universitario';
  const prNumber = 74;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': 'Bearer ' + token,
    'User-Agent': 'EvaluaPro-Release-Agent',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  console.log(`[Auto-Merge] Monitoreando PR #${prNumber} hasta que los checks de CI concluyan...`);

  let attempts = 0;
  const maxAttempts = 30; // ~10 minutos máx

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n--- Intento ${attempts}/${maxAttempts} ---`);

    // Intentar merge directo
    const mergeRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        commit_title: `Merge pull request #${prNumber} from Dtcsrni/feat/ux-redisenio-integral-1.1.1`,
        commit_message: 'feat(release): consolidacion linea base v1.1.1, iconos transparentes y modernizacion landing page',
        merge_method: 'merge'
      })
    });

    const mergeData = await mergeRes.json();
    if (mergeRes.ok) {
      console.log(`\n🎉 ¡PR #${prNumber} FUSIONADO CON ÉXITO EN MAIN!`);
      console.log('SHA de Merge:', mergeData.sha);
      console.log('GitHub Actions iniciará el despliegue de GitHub Pages inmediatamente.');
      return;
    }

    if (mergeData.message && mergeData.message.includes('Pull Request is not mergeable')) {
      console.log('  - Estado: Pendiente de checks o bloqueado temporalmente por GitHub.');
    } else {
      console.log('  - Respuesta de GitHub:', mergeData.message || JSON.stringify(mergeData));
    }

    // Consultar estado de checks
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    const pr = await prRes.json();
    console.log(`  - Mergeable state: ${pr.mergeable_state}`);

    const checkRunsRes = await fetch(`https://api.github.com/repos/${repo}/commits/${pr.head.sha}/check-runs`, { headers });
    const checkRuns = await checkRunsRes.json();
    if (checkRuns.check_runs) {
      const running = checkRuns.check_runs.filter(c => c.status !== 'completed');
      const completed = checkRuns.check_runs.filter(c => c.status === 'completed');
      console.log(`  - Checks completados: ${completed.length}/${checkRuns.total_count} | En progreso: ${running.map(r => r.name).join(', ') || 'Ninguno'}`);
    }

    // Esperar 20 segundos antes del siguiente intento
    await new Promise(r => setTimeout(r, 20000));
  }

  console.log('\n[Auto-Merge] Tiempo límite de espera alcanzado. El PR permanece abierto para merge en cuanto terminen los runners.');
}

main().catch(console.error);
