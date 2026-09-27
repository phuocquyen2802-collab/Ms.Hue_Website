const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const os = require('os');

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
  const wmfBuf = await zip.files[media[0]].async('nodebuffer');

  const attempts = [
    ['default', 'png'],
    ['pixelwidth', 'png:draw_png_Export:{"PixelWidth":{"type":"long","value":"3000"},"PixelHeight":{"type":"long","value":"4200"}}'],
    ['logicalwidth', 'png:draw_png_Export:{"LogicalWidth":{"type":"long","value":"30000"},"LogicalHeight":{"type":"long","value":"42000"}}'],
  ];

  for (const [name, filter] of attempts) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dpi-' + name + '-'));
    fs.writeFileSync(path.join(tmp, 'test.wmf'), wmfBuf);
    try {
      await runSoffice(['--headless', '--convert-to', filter, '--outdir', tmp, path.join(tmp, 'test.wmf')]);
      const sharp = require('sharp');
      const meta = await sharp(path.join(tmp, 'test.png')).metadata();
      console.log(name, '-> dimensions:', meta.width, 'x', meta.height);
    } catch (e) {
      console.log(name, '-> ERROR:', e.message.slice(0, 200));
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
