// Incrusta el ícono y los datos de versión en el .exe sin necesidad de Wine (usa resedit, JavaScript puro).
const fs = require('fs'), path = require('path'), ResEdit = require('resedit');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const bin = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(bin);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'build', 'icon.ico')));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const v = ctx.packager.appInfo.version.split('.').map(Number);
  vi.setFileVersion(v[0], v[1], v[2], 0); vi.setProductVersion(v[0], v[1], v[2], 0);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'PERLA 3 CIFRAS PRO', ProductName: 'PERLA 3 CIFRAS PRO', CompanyName: 'Uso personal',
    LegalCopyright: 'Uso personal', OriginalFilename: path.basename(exe), InternalName: 'PERLA3CIFRAS_PRO',
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(bin);
  fs.writeFileSync(exe, Buffer.from(bin.generate()));
  console.log('  • ícono y versión incrustados en', path.basename(exe));
};
