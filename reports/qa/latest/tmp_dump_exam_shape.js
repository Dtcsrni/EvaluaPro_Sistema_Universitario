const dbx = db.getSiblingDB('mern_app_prod');
const examen = dbx.examenesGenerados.findOne({ plantillaId: ObjectId('69a6f849c2c6e9f7684bdfd8'), archivadoEn: null, 'mapaOmr.paginas.3': { $exists: true } });
printjson({ found: !!examen, id: examen?._id, folio: examen?.folio, paginas: examen?.mapaOmr?.paginas?.length, preguntasP1: examen?.mapaOmr?.paginas?.[0]?.preguntas?.length, qrP1: examen?.mapaOmr?.paginas?.[0]?.qr?.texto });
