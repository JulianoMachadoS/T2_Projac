// Demonstracao ao vivo do T2: le os cenarios de roteiros.json e executa cada passo
// no navegador (Chrome), conferindo o resultado como um teste de sistema.
//
//   node demo.mjs                      lista os cenarios
//   node demo.mjs sincronizacao        roda um cenario (pode passar varios)
//   node demo.mjs sincronizacao --passo   espera Enter antes de cada passo (apresentacao)
//   node demo.mjs sincronizacao --fechar  fecha o navegador no fim sem perguntar
//
// Cada passo do JSON pode ter: legenda, abrir, preencher, clicar, destacar, comando
// (+ guardar/exibir), http (+ encontrar/lista/esperar/quantidade/ate/guardar/mostrar),
// pausa e seTiver. {{nome}} e trocado pelo valor guardado num passo anterior.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(pasta, '..');
const { config, cenarios } = JSON.parse(readFileSync(path.join(pasta, 'roteiros.json'), 'utf8'));

const args = process.argv.slice(2);
const pausarCadaPasso = args.includes('--passo');
const fecharNoFim = args.includes('--fechar');
const escolhidos = args.filter((a) => !a.startsWith('--'));

if (escolhidos.length === 0) {
  console.log('Cenarios em roteiros.json:');
  for (const [nome, c] of Object.entries(cenarios)) console.log(`  ${nome.padEnd(16)} ${c.descricao}`);
  console.log('\nUso: node demo.mjs <cenario> [--passo] [--fechar]');
  process.exit(0);
}
for (const nome of escolhidos) {
  if (!cenarios[nome]) {
    console.error(`Cenario desconhecido: ${nome}`);
    process.exit(1);
  }
}

const teclado = createInterface({ input: process.stdin, output: process.stdout });
const navegador = await abrirNavegador();
const pagina = await (await navegador.newContext({ viewport: null })).newPage();
let legenda = '';
let capturas = 0;
pagina.on('load', () => mostrarLegenda());

// {{nome}} nos passos e trocado pelo valor guardado (config + o que os passos guardam)
let vars = {};
const trocar = (v) =>
  typeof v === 'string'
    ? v.replace(/\{\{(\w+)\}\}/g, (_, n) => vars[n] ?? '')
    : Array.isArray(v)
      ? v.map(trocar)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trocar(x)]))
        : v;

let falhou = false;
for (const nome of escolhidos) {
  if (!(await rodarCenario(nome, cenarios[nome]))) falhou = true;
}

console.log(falhou ? '\nRESULTADO: FALHOU' : '\nRESULTADO: OK');
if (!fecharNoFim) await teclado.question('Enter fecha o navegador... ');
teclado.close();
await navegador.close();
process.exit(falhou ? 1 : 0);

// ---------------------------------------------------------------- cenario

async function rodarCenario(nome, cenario) {
  vars = { ...config };
  console.log(`\n=== ${nome}: ${cenario.descricao} ===`);
  let ok = true;
  for (const [i, passo] of cenario.passos.entries()) {
    const titulo = trocar(passo.legenda ?? passo.http ?? passo.comando ?? passo.abrir ?? '');
    if (pausarCadaPasso && passo.legenda) await teclado.question(`\n> ${titulo}  [Enter]`);
    const inicio = Date.now();
    try {
      const pulou = await executar(passo);
      const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
      console.log(`  ${pulou ? '-' : '✔'} ${i + 1}. ${titulo.slice(0, 90)}  (${tempo} s)`);
    } catch (erro) {
      console.log(`  ✘ ${i + 1}. ${titulo.slice(0, 90)}\n      ${erro.message}`);
      legenda = `FALHOU: ${erro.message}`;
      await mostrarLegenda('#b00020');
      ok = false;
      break;
    }
  }
  // limpeza roda sempre, mesmo se um passo falhou
  for (const passo of cenario.limpeza ?? []) {
    try {
      await executar({ ...passo, exibir: false });
    } catch {
      // ignora: limpeza nao pode esconder o resultado do cenario
    }
  }
  console.log(ok ? `  OK: ${nome}` : `  FALHOU: ${nome}`);
  return ok;
}

// ---------------------------------------------------------------- passos

async function executar(passoOriginal) {
  const p = trocar(passoOriginal);
  if (p.seTiver && !vars[p.seTiver]) return true;

  if (p.legenda) {
    legenda = p.legenda;
    await mostrarLegenda();
  }
  if (p.abrir) await pagina.goto(p.abrir, { waitUntil: 'networkidle' });
  for (const [seletor, texto] of Object.entries(p.preencher ?? {})) {
    await pagina.locator(seletor).fill('');
    await pagina.locator(seletor).pressSequentially(texto, { delay: 40 });
  }
  if (p.clicar) {
    // espera sair da pagina atual (login), senao o proximo "abrir" cancela o envio
    const antes = pagina.url();
    await pagina.click(p.clicar);
    await pagina.waitForURL((url) => url.href !== antes, { timeout: 15000 }).catch(() => {});
    await pagina.waitForLoadState('networkidle');
  }
  if (p.destacar) {
    const alvo = pagina.locator(p.destacar);
    await alvo.evaluate((el) => {
      el.scrollIntoView({ block: 'center' });
      el.style.outline = '4px solid #e8590c';
      if (el.tagName === 'INPUT') el.style.minWidth = '22ch'; // campo estreito corta o valor
    });
  }
  if (p.comando) await comando(p);
  if (p.http) await http(p);
  if (p.pausa) await pagina.waitForTimeout(p.pausa * 1000);
  // DEMO_CAPTURAS=pasta salva uma imagem da tela depois de cada passo (para conferir depois)
  if (process.env.DEMO_CAPTURAS) {
    capturas++;
    await pagina.screenshot({ path: path.join(process.env.DEMO_CAPTURAS, `${String(capturas).padStart(2, '0')}.png`) });
  }
  return false;
}

async function comando(p) {
  const saida = execSync(p.comando, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (p.guardar) vars[p.guardar] = saida.split('\n').pop().trim();
  if (p.exibir) await mostrarTela(`$ ${p.comando}`, '', saida || '(sem saida)');
}

// chamada HTTP; com "ate" repete a cada 2 s ate a resposta bater com "esperar"
async function http(p) {
  const [metodo, alvo] = p.http.split(' ');
  const peloGateway = alvo.startsWith('/');
  const url = peloGateway ? config.gateway + alvo : alvo;
  const headers = {};
  if (peloGateway) headers['X-Api-Key'] = config.apiKey;
  if (p.correlationId) headers['X-Correlation-ID'] = p.correlationId;
  if (p.usuario) headers.Authorization = `Basic ${Buffer.from(p.usuario).toString('base64')}`;

  const limite = Date.now() + (p.ate ?? 0) * 1000;
  for (let tentativa = 1; ; tentativa++) {
    let status = 0;
    let corpo;
    let achados = [];
    let ok = false;
    try {
      const resposta = await fetch(url, { method: metodo, headers });
      status = resposta.status;
      const texto = await resposta.text();
      try {
        corpo = JSON.parse(texto);
      } catch {
        corpo = texto.slice(0, 300);
      }
      achados = encontrar(corpo, p);
      ok =
        resposta.ok &&
        (!p.encontrar || achados.length > 0) &&
        (p.quantidade === undefined || achados.length === Number(p.quantidade)) &&
        bate(achados[0], p.esperar);
    } catch (erro) {
      corpo = `sem resposta (${erro.cause?.code ?? erro.message})`;
    }

    let mostrado = p.encontrar ? (achados.length ? achados : '(nao encontrado)') : corpo;
    if (p.mostrar && corpo && typeof corpo === 'object') {
      mostrado = Object.fromEntries(p.mostrar.map((campo) => [campo, corpo[campo]]));
    }
    const linha = `${metodo} ${url.replace(/wstoken=\w+/, 'wstoken=...')}`;
    const esperado = p.esperar ? ` · esperando ${JSON.stringify(p.esperar)}` : '';
    if (p.exibir !== false) await mostrarTela(linha, `HTTP ${status} · tentativa ${tentativa}${esperado}`, mostrado);

    if (ok) {
      for (const [nome, campo] of Object.entries(p.guardar ?? {})) vars[nome] = String(achados[0]?.[campo] ?? corpo?.[campo]);
      return;
    }
    if (Date.now() > limite) {
      throw new Error(`${p.http}: esperado ${JSON.stringify(p.esperar ?? 'HTTP 2xx')}, veio HTTP ${status} ${JSON.stringify(mostrado).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// itens de uma lista (ou de corpo[lista]) cujos campos batem com "encontrar"
function encontrar(corpo, p) {
  if (!p.encontrar) return [corpo];
  const lista = p.lista ? corpo?.[p.lista] : corpo;
  if (!Array.isArray(lista)) return [];
  return lista.filter((item) => bate(item, p.encontrar));
}

function bate(item, campos) {
  if (!campos) return true;
  if (!item) return false;
  // ">5" compara numero (ex.: a DLQ tem mais mensagens que antes); o resto compara igual
  return Object.entries(campos).every(([k, v]) =>
    String(v).startsWith('>') ? Number(item[k]) > Number(String(v).slice(1)) : String(item[k]) === String(v),
  );
}

// ---------------------------------------------------------------- tela

async function abrirNavegador() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: false, slowMo: 150, args: ['--start-maximized'] });
  } catch {
    // sem Chrome instalado: usa o Chromium do Playwright (npx playwright install chromium)
    return chromium.launch({ headless: false, slowMo: 150, args: ['--start-maximized'] });
  }
}

function escapar(texto) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

async function mostrarTela(titulo, subtitulo, conteudo) {
  const texto = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2);
  await pagina.setContent(`<!doctype html><meta charset="utf-8">
    <body style="margin:0;padding:32px 40px 120px;font:18px system-ui;background:#f6f7f9;color:#1d2330">
      <div style="font:600 22px ui-monospace,monospace">${escapar(titulo)}</div>
      <div style="margin:8px 0 20px;color:#555">${escapar(subtitulo)}</div>
      <pre style="font:17px/1.45 ui-monospace,monospace;background:#fff;border:1px solid #d8dbe2;border-radius:8px;padding:20px;white-space:pre-wrap;word-break:break-all">${escapar(texto)}</pre>
    </body>`);
  await mostrarLegenda();
}

async function mostrarLegenda(cor = '#1f3a8a') {
  if (!legenda) return;
  await pagina
    .evaluate(
      ([texto, fundo]) => {
        let faixa = document.getElementById('demo-legenda');
        if (!faixa) {
          faixa = document.createElement('div');
          faixa.id = 'demo-legenda';
          faixa.style.cssText =
            'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:18px 28px;color:#fff;font:600 24px system-ui;box-shadow:0 -2px 8px rgba(0,0,0,.25)';
          document.body.appendChild(faixa);
        }
        faixa.style.background = fundo;
        faixa.textContent = texto;
      },
      [legenda, cor],
    )
    .catch(() => {});
}
