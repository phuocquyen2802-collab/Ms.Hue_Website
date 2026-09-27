const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const os = require('os');
const sharp = require('sharp');

function runSoffice(args) {
  return new Promise((resolve, reject) => {
    execFile('C:/Program Files/LibreOffice/program/soffice.exe', args, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(err.message + '\n' + stderr));
      resolve(stdout);
    });
  });
}

async function main() {
  const dir = path.join(__dirname, '..', 'Đề mẫu', 'Đề chuẩn');
  const JSZip = require('jszip');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.docx') && !f.startsWith('~') && !f.toLowerCase().includes('đáp'));
  const buf = fs.readFileSync(path.join(dir, files[0]));
  const zip = await JSZip.loadAsync(buf);
  const media = Object.keys(zip.files).filter(n => n.toLowerCase().startsWith('word/media/') && n.toLowerCase().endsWith('.wmf'));
  // pick a formula with a fraction (from earlier session: image12.wmf had a fraction) - just try first 5 and pick one with decent size after trim
  for (const m of media.slice(0, 6)) {
    const wmfBuf = await zip.files[m].async('nodebuffer');
    for (const [name, filter] of [['default', 'png'], ['3x', 'png:draw_png_Export:{"PixelWidth":{"type":"long","value":"2976"},"PixelHeight":{"type":"long","value":"4209"}}']]) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-' + name + '-'));
      fs.writeFileSync(path.join(tmp, 'test.wmf'), wmfBuf);
      await runSoffice(['--headless', '--convert-to', filter, '--outdir', tmp, path.join(tmp, 'test.wmf')]);
      const trimmed = await sharp(path.join(tmp, 'test.png')).trim({ background: '#ffffff', threshold: 10 }).png().toBuffer();
      const meta = await sharp(trimmed).metadata();
      const outName = `scratch_${path.basename(m, '.wmf')}_${name}.png`;
      fs.writeFileSync(path.join(__dirname, outName), trimmed);
      console.log(m, name, '-> trimmed size:', meta.width, 'x', meta.height, '-> saved as', outName);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
