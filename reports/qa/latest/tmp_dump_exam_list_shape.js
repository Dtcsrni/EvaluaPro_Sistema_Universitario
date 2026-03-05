const dbx = db.getSiblingDB('mern_app_prod');
const examenes = dbx.examenesGenerados.find({ plantillaId: ObjectId('69a6f849c2c6e9f7684bdfd8'), archivadoEn: null }, { folio: 1, mapaOmr: 1, preguntasIds: 1 }).toArray();
printjson({ total: examenes.length, uniqueFolio: [...new Set(examenes.map((e) => e.folio))].length, completeMaps: examenes.filter((e) => e?.mapaOmr?.paginas?.length === 4).length, completeQuestions: examenes.filter((e) => Array.isArray(e?.preguntasIds) && e.preguntasIds.length === 50).length });
