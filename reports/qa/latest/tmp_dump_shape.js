const dbx = db.getSiblingDB('mern_app_prod');
const preguntas = dbx.bancoPreguntas.find({ tema: 'OMR TV3', activo: true }).sort({ createdAt: 1 }).toArray();
printjson({ total: preguntas.length, firstId: preguntas[0]?._id, lastId: preguntas[preguntas.length-1]?._id, sampleKeys: preguntas[0] ? Object.keys(preguntas[0]) : [] });
