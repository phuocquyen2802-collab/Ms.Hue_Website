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
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.docx') && !f.startsWith('~') && !f.toLowerCase().includes('đáp'));

  // Extract one WMF sample from the docx for testing
  const JSZip = require('jszip');
  const buf = fs.readFileSync(path.join(dir, files[0]));
  const zip = await JSZip.loadAsync(buf);
  const media = Object.keys(zip.files).filter(n => n.toLowerCase().startsWith('word/media/') && n.toLowerCase().endsWith('.wmf'));
  const wmfBuf = await zip.files[media[0]].async('nodebuffer');

  const tmpDefault = fs.mkdtempSync(path.join(os.tmpdir(), 'dpi-default-'));
  const tmpHighRes = fs.mkdtempSync(path.join(os.tmpdir(), 'dpi-high-'));
  fs.writeFileSync(path.join(tmpDefault, 'test.wmf'), wmfBuf);
  fs.writeFileSync(path.join(tmpHighRes, 'test.wmf'), wmfBuf);

  console.log('Converting with DEFAULT resolution...');
  await runSoffice(['--headless', '--convert-to', 'png', '--outdir', tmpDefault, path.join(tmpDefault, 'test.wmf')]);

  console.log('Converting with HIGH resolution (300 DPI)...');
  await runSoffice(['--headless', '--convert-to', 'png:draw_png_Export:{"Resolution":{"type":"long","value":"300"}}', '--outdir', tmpHighRes, path.join(tmpHighRes, 'test.wmf')]);

  const defaultMeta = fs.statSync(path.join(tmpDefault, 'test.png'));
  const highResMeta = fs.statSync(path.join(tmpHighRes, 'test.png'));
  console.log('Default PNG size:', defaultMeta.size, 'bytes');
  console.log('High-res PNG size:', highResMeta.size, 'bytes');

  const sharp = require('sharp');
  const defaultDim = await sharp(path.join(tmpDefault, 'test.png')).metadata();
  const highResDim = await sharp(path.join(tmpHighRes, 'test.png')).metadata();
  console.log('Default dimensions:', defaultDim.width, 'x', defaultDim.height);
  console.log('High-res dimensions:', highResDim.width, 'x', highResDim.height);

  fs.copyFileSync(path.join(tmpDefault, 'test.png'), path.join(__dirname, 'scratch_default.png'));
  fs.copyFileSync(path.join(tmpHighRes, 'test.png'), path.join(__dirname, 'scratch_highres.png'));
}
main().catch(e => { console.error(e); process.exit(1); });
