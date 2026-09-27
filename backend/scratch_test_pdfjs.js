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
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

  const dir = path.join(__dirname, '..', 'Đề mẫu', 'Đề chuẩn');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.docx') && !f.startsWith('~') && !f.toLowerCase().includes('đáp'));
  const file = path.join(dir, files[0]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfjs-test-'));
  fs.copyFileSync(file, path.join(tmp, 'test.docx'));
  await runSoffice(['--headless', '--convert-to', 'pdf', '--outdir', tmp, path.join(tmp, 'test.docx')]);
  const pdfBuffer = fs.readFileSync(path.join(tmp, 'test.pdf'));

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  console.log('Total items on page 1:', content.items.length);
  console.log('--- First 20 raw items (str, x, y) ---');
  content.items.slice(0, 20).forEach(it => {
    console.log(JSON.stringify(it.str), 'x=' + it.transform[4].toFixed(1), 'y=' + it.transform[5].toFixed(1));
  });
}
main().catch(e => { console.error(e); process.exit(1); });
