// Gera os ícones do EarMix (app icon, splash, adaptive, logo, favicon) a partir
// de um SVG vetorial — a marca são três faders (o elemento-assinatura do app).
// Uso: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const GREEN = '#34C759';
const GREEN_DK = '#28A24A';
const TRACK = '#23232E';
const CAP = '#F4F4F8';
const BLUE = '#3B82F6'; // fone
const BLUE_DK = '#2563EB';
const CUSHION = '#0F1117'; // almofada interna (escura) das conchas
const BG_TOP = '#15151D';
const BG_BOT = '#0A0A0E';

// 3 faders centrados, com alturas variadas (como na mesa real).
// Cada item: x da trilha e y do "cap" (quanto menor o y, mais alto o fader).
const TRACK_W = 66;
const TOP = 400;
const BOTTOM = 792;
const RX = TRACK_W / 2;
const COLS = [
  { x: 389, cap: 486 },
  { x: 479, cap: 446 },
  { x: 569, cap: 508 },
];

function faders() {
  return COLS.map(({ x, cap }) => {
    const fillH = BOTTOM - cap;
    const capX = x + RX - 47;
    return `
      <rect x="${x}" y="${TOP}" width="${TRACK_W}" height="${BOTTOM - TOP}" rx="${RX}" fill="${TRACK}"/>
      <rect x="${x}" y="${cap}" width="${TRACK_W}" height="${fillH}" rx="${RX}" fill="url(#g)"/>
      <rect x="${capX}" y="${cap - 16}" width="94" height="32" rx="13" fill="${CAP}"/>`;
  }).join('');
}

// Fone over-ear "em pé": laterais quase verticais subindo das conchas + topo bem
// arredondado e alto (silhueta de fone real, não achatada).
function headset() {
  const cupW = 116;
  const cupH = 270;
  const cupY = 392;
  const lx = 226; // x da concha esquerda
  const rx = 682; // x da concha direita
  const lcx = lx + cupW / 2; // 284
  const rcx = rx + cupW / 2; // 740
  const bandBottom = cupY + 28;
  const archTop = 150; // quanto menor, mais alto/“em pé” o arco
  return `
    <!-- headband: laterais verticais (tangente para cima nas pontas) + topo arredondado -->
    <path d="M ${lcx} ${bandBottom} C ${lcx} ${archTop}, ${rcx} ${archTop}, ${rcx} ${bandBottom}"
          fill="none" stroke="url(#b)" stroke-width="58" stroke-linecap="round"/>
    <!-- conchas (over-ear), capsulas verticais -->
    <rect x="${lx}" y="${cupY}" width="${cupW}" height="${cupH}" rx="${cupW / 2}" fill="url(#b)"/>
    <rect x="${rx}" y="${cupY}" width="${cupW}" height="${cupH}" rx="${cupW / 2}" fill="url(#b)"/>
    <!-- almofadas internas (profundidade de fone real) -->
    <rect x="${lx + 30}" y="${cupY + 46}" width="${cupW - 60}" height="${cupH - 92}" rx="${(cupW - 60) / 2}" fill="${CUSHION}"/>
    <rect x="${rx + 30}" y="${cupY + 46}" width="${cupW - 60}" height="${cupH - 92}" rx="${(cupW - 60) / 2}" fill="${CUSHION}"/>`;
}

/** scale: fator da marca (1 = base). bg: desenha fundo do app icon. */
function svg({ bg, scale = 1 }) {
  const defs = `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${GREEN}"/>
        <stop offset="1" stop-color="${GREEN_DK}"/>
      </linearGradient>
      <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${BLUE}"/>
        <stop offset="1" stop-color="${BLUE_DK}"/>
      </linearGradient>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${BG_TOP}"/>
        <stop offset="1" stop-color="${BG_BOT}"/>
      </linearGradient>
    </defs>`;
  const background = bg ? `<rect width="1024" height="1024" fill="url(#bg)"/>` : '';
  // Centro vertical REAL da marca (headset arco ~121 .. faders 792). Centralizamos a
  // marca no canvas (senão fica alta, deixando mais preto embaixo) e escalamos daí.
  const MARK_CY = 456;
  const mark = `<g transform="translate(512,512) scale(${scale}) translate(-512,${-MARK_CY})">${headset()}${faders()}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${background}${mark}</svg>`;
}

async function render(svgStr, size, out) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(join(ASSETS, out));
  console.log('✔', out, `${size}x${size}`);
}

/** Só o fundo em gradiente (para compor a marca por cima, centralizada). */
function bgOnly() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOT}"/>
    </linearGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/></svg>`;
}

/**
 * Gera um ícone com a marca RECORTADA (trim) e composta no CENTRO exato do canvas —
 * garante bordas iguais em cima/embaixo. `fraction` = altura da marca / tamanho do ícone.
 */
async function renderCentered(size, out, { bg, fraction }) {
  const markTrim = await sharp(Buffer.from(svg({ bg: false, scale: 1 }))).trim().toBuffer();
  const mark = await sharp(markTrim)
    .resize({ height: Math.round(size * fraction), fit: 'inside' })
    .png()
    .toBuffer();
  const base = bg
    ? sharp(Buffer.from(bgOnly())).resize(size, size)
    : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  await base.composite([{ input: mark, gravity: 'center' }]).png().toFile(join(ASSETS, out));
  console.log('✔', out, `${size} (centrado, ${Math.round(fraction * 100)}%)`);
}

const tasks = [
  // Splash: marca sobre transparente (a tela é preta no app.json).
  [svg({ bg: false, scale: 0.8 }), 1024, 'splash-icon.png'],
];

for (const [s, size, out] of tasks) await render(s, size, out);

// Ícones com a marca RECORTADA e centralizada (bordas iguais em cima/embaixo):
// App icon iOS (fundo + marca ~72% da altura).
await renderCentered(1024, 'icon.png', { bg: true, fraction: 0.72 });
await renderCentered(64, 'favicon.png', { bg: true, fraction: 0.72 });
// Android adaptive foreground/monochrome (~66% = dentro da zona segura do adaptive icon).
await renderCentered(1024, 'android-icon-foreground.png', { bg: false, fraction: 0.66 });
await renderCentered(1024, 'android-icon-monochrome.png', { bg: false, fraction: 0.66 });

// Logo in-app: recortado (trim) na marca, sem padding transparente, para o
// espaçamento até o texto ser controlado pelo layout (não pela margem da imagem).
await sharp(Buffer.from(svg({ bg: false, scale: 1 })))
  .trim()
  .resize({ height: 360 })
  .png()
  .toFile(join(ASSETS, 'logo.png'));
console.log('✔ logo.png (trimmed)');

console.log('Ícones gerados em', ASSETS);
