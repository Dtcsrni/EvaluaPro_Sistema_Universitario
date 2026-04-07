import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('build-msi exige WiX 6+ estable y docs no referencian v4', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
  const wixReadme = fs.readFileSync(path.join(root, 'packaging', 'wix', 'README.md'), 'utf8');
  const deployDoc = fs.readFileSync(path.join(root, 'docs', 'DESPLIEGUE.md'), 'utf8');

  assert.match(buildScript, /WiX Toolset v6\.0\.x/i);
  assert.match(buildScript, /major.+6|6\.0\.x/i);

  assert.doesNotMatch(wixReadme, /WiX Toolset v4/i);
  assert.doesNotMatch(deployDoc, /WiX Toolset v4/i);
});

test('build-msi detecta wix.exe en rutas estandar de Windows sin depender del PATH', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');

  assert.match(buildScript, /ProgramFiles.*WiX Toolset v6\.0\\bin\\wix\.exe/i);
  assert.match(buildScript, /ProgramFiles\(x86\)/i);
  assert.match(buildScript, /Get-Command wix/i);
  assert.match(buildScript, /& \$wixExe @productArgs/i);
});

test('bundle usa BA personalizada Burn y build-msi publica bootstrapper .NET 8', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
  const bundleWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Bundle.wxs'), 'utf8');
  const productWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Product.wxs'), 'utf8');
  const bootstrapperProject = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaPro.BurnBootstrapperApp.csproj'), 'utf8');

  assert.match(buildScript, /Resolve-BalExtensionDll/i);
  assert.match(buildScript, /Publish-BurnBootstrapperApp/i);
  assert.match(buildScript, /\$DotNetExecutable publish/i);
  assert.match(buildScript, /WixToolset\.Bal\.wixext/i);
  assert.match(buildScript, /WixToolset\.BootstrapperApplications\.wixext\.dll/i);
  assert.match(bootstrapperProject, /<ApplicationIcon>.*dashboard-hub-app\.ico<\/ApplicationIcon>/i);
  assert.match(buildScript, /Assert-CanonicalInstallerIcon/i);
  assert.match(buildScript, /16,\s*24,\s*32,\s*48,\s*64,\s*128,\s*256/i);

  assert.match(bundleWxs, /<BootstrapperApplication[^>]+SourceFile="EvaluaPro\.BurnBootstrapperApp\.exe"/i);
  assert.match(bundleWxs, /IconSourceFile="(?:.*installer-canonical\.ico|\$\(var\.BundleIconPath\))"/i);
  assert.match(bundleWxs, /<ApprovedExeForElevation/i);
  assert.match(bundleWxs, /InstallerBurnHelper\.ps1/i);
  assert.match(bundleWxs, /SourceFile="\$\(var\.MsiSourcePath\)"/i);
  assert.doesNotMatch(bundleWxs, /WixStandardBootstrapperApplication/i);
  assert.doesNotMatch(bundleWxs, /<BootstrapperApplicationRef/i);
  assert.match(productWxs, /<Icon Id="EvaluaProIconHub" SourceFile=".*installer-canonical\.ico"/i);
  assert.match(productWxs, /<Property Id="ARPPRODUCTICON" Value="EvaluaProIconHub"/i);
});
