import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import test from 'node:test';import assert from 'node:assert/strict';
import { inspectModuleContracts } from '../module-contract-check.mjs';

const temporaryRoots=[];
function fixture({ importsA="import '../b/index.js';", importsB='', dependenciesA=[{module:'b',contractRange:'^1.0.0'}], dependenciesB=[], hostCompatibilityA='>=1.2.0 <2.0.0', hostCompatibilityB='>=1.2.0 <2.0.0', versionB='1.0.0', ownersA=['User'], ownersB=[] }={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'evaluapro-module-contract-'));temporaryRoots.push(root);
  const write=(rel,content)=>{const target=path.join(root,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content,'utf8')};
  write('src/modulos/a/index.ts',`${importsA}\n`);write('src/modulos/b/index.ts',`${importsB}\n`);write('apps/backend/prisma/schema.prisma','model User {\n id String @id\n}\n');
  const module=(id,dependencies,hostCompatibility,persistenceModels,contractVersion='1.0.0')=>({id,contractVersion,entry:`src/modulos/${id}/index.ts`,hostCompatibility,dependencies,persistenceModels});
  write('contracts.json',JSON.stringify({schemaVersion:1,host:{version:'1.2.0',compatibility:'>=1.2.0 <2.0.0'},persistence:{migrationStrategy:'expand-migrate-contract',singleDatabase:true},modules:[module('a',dependenciesA,hostCompatibilityA,ownersA),module('b',dependenciesB,hostCompatibilityB,ownersB,versionB)]}));
  return root;
}

test('la base vigente registra todos los módulos, sin ciclos ni modelos huérfanos',()=>{
  const result=inspectModuleContracts({root:process.cwd()});
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.equal(result.modules,21);
  assert.equal(result.cycles.length,0);
  assert.equal(result.declaredModelOwners,result.prismaModels);
});

test('las entradas públicas no cargan routers del composition root',()=>{
  const root=path.join(process.cwd(),'apps/backend/src/modulos');
  const modules=fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory());
  for(const module of modules){
    const entry=path.join(root,module.name,'index.ts');
    if(!fs.existsSync(entry)) continue;
    const source=fs.readFileSync(entry,'utf8');
    assert.doesNotMatch(source,/export\s+\{\s*default\s+as\s+\w+\s*\}\s+from\s+['\"]\.\/rutas/,`${module.name} debe exponer rutas solo en el composition root`);
  }
});

test('acepta una integración pública con rangos compatibles y propietario único',()=>{
  const result=inspectModuleContracts({root:fixture() ,moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.equal(result.ok,true,result.errors.join('\n'));
});

test('rechaza imports a archivos privados de otro módulo',()=>{
  const root=fixture({importsA:"import '../b/private.js';"});
  fs.writeFileSync(path.join(root,'src/modulos/b/private.ts'),'export const internal = true;\n','utf8');
  const result=inspectModuleContracts({root,moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.ok(result.errors.some(error=>error.includes('a.private-import')));
});

test('rechaza dependencias reales ausentes del registro',()=>{
  const root=fixture({dependenciesA:[]});
  const result=inspectModuleContracts({root,moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.ok(result.errors.some(error=>error.includes('a.dependency.undeclared')));
});

test('rechaza ciclos entre módulos',()=>{
  const root=fixture({importsB:"import '../a/index.js';",dependenciesB:[{module:'a',contractRange:'^1.0.0'}]});
  const result=inspectModuleContracts({root,moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.ok(result.errors.some(error=>error.startsWith('dependency.cycle:')));
});

test('rechaza un rango de host incompatible',()=>{
  const root=fixture({hostCompatibilityB:'>=1.3.0 <2.0.0'});
  const result=inspectModuleContracts({root,moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.ok(result.errors.some(error=>error.includes('b.hostCompatibility')));
});

test('rechaza una versión de dependencia fuera del rango consumido',()=>{
  const root=fixture({versionB:'2.0.0'});
  const result=inspectModuleContracts({root,moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.ok(result.errors.some(error=>error.includes('a.dependency.incompatible')));
});

test('rechaza modelos sin propietario y modelos con varios propietarios',()=>{
  const missing=inspectModuleContracts({root:fixture({ownersA:[]}),moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.ok(missing.errors.some(error=>error.includes('persistence.owner.missing: User')));
  const duplicate=inspectModuleContracts({root:fixture({ownersB:['User']}),moduleRoot:'src/modulos',manifestPath:'contracts.json',prismaSchemaPath:'apps/backend/prisma/schema.prisma'});
  assert.ok(duplicate.errors.some(error=>error.includes('persistence.owner.duplicate: User')));
});

test.after(()=>{for(const root of temporaryRoots)fs.rmSync(root,{recursive:true,force:true})});
