const { MSICreator } = require('electron-wix-msi');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');

async function buildMSI() {
  const appDir = path.resolve(__dirname, '../release/win-unpacked');
  const outputDir = path.resolve(__dirname, '../release');

  const creator = new MSICreator({
    appDirectory: appDir,
    outputDirectory: outputDir,
    description: pkg.description,
    exe: 'Ledgr.exe',
    name: 'Ledgr',
    manufacturer: 'TechLoom',
    version: pkg.version,
    icon: path.resolve(__dirname, '../build/icon.ico'),
    arch: 'x64',
    ui: {
      chooseDirectory: true
    },
    defaultInstallMode: 'perMachine',
    shortcutFolderName: 'Ledgr',
    shortcutName: 'Ledgr',
    features: {
      autoUpdate: false,
      autoLaunch: true
    }
  });

  await creator.create();
  await creator.compile();

  // Rename to include version
  const defaultMsi = path.join(outputDir, 'Ledgr.msi');
  const versionedMsi = path.join(outputDir, `Ledgr-${pkg.version}.msi`);
  if (fs.existsSync(defaultMsi)) {
    fs.renameSync(defaultMsi, versionedMsi);
    console.log(`MSI created successfully: Ledgr-${pkg.version}.msi`);
  } else {
    console.log('MSI created successfully');
  }
}

buildMSI().catch(err => {
  console.error('MSI build failed:', err);
  process.exit(1);
});
