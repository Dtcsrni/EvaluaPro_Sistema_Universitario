const dbx = db.getSiblingDB("mern_app_prod");
const ids = dbx.examenesGenerados.find({}, { _id: 1 }).toArray().map((d) => d._id);
const before = {
  examenesGenerados: dbx.examenesGenerados.countDocuments(),
  entregas: dbx.entregas.countDocuments({ examenGeneradoId: { $in: ids } }),
  calificaciones: dbx.calificaciones.countDocuments({ examenGeneradoId: { $in: ids } }),
  banderasRevision: dbx.banderasRevision.countDocuments({ examenGeneradoId: { $in: ids } }),
  escaneosOmrArchivados: dbx.escaneosOmrArchivados.countDocuments({ examenGeneradoId: { $in: ids } }),
  solicitudesRevisionAlumno: dbx.solicitudesRevisionAlumno.countDocuments({ examenGeneradoId: { $in: ids } }),
  componentesExamen: dbx.componentesExamen.countDocuments({ examenGeneradoId: { $in: ids } }),
  omrScanJobs: dbx.omrScanJobs.countDocuments({ generatedAssessmentId: { $in: ids } })
};
const deleted = {
  entregas: ids.length ? dbx.entregas.deleteMany({ examenGeneradoId: { $in: ids } }).deletedCount : 0,
  calificaciones: ids.length ? dbx.calificaciones.deleteMany({ examenGeneradoId: { $in: ids } }).deletedCount : 0,
  banderasRevision: ids.length ? dbx.banderasRevision.deleteMany({ examenGeneradoId: { $in: ids } }).deletedCount : 0,
  escaneosOmrArchivados: ids.length ? dbx.escaneosOmrArchivados.deleteMany({ examenGeneradoId: { $in: ids } }).deletedCount : 0,
  solicitudesRevisionAlumno: ids.length ? dbx.solicitudesRevisionAlumno.deleteMany({ examenGeneradoId: { $in: ids } }).deletedCount : 0,
  componentesExamen: ids.length ? dbx.componentesExamen.deleteMany({ examenGeneradoId: { $in: ids } }).deletedCount : 0,
  omrScanJobs: ids.length ? dbx.omrScanJobs.deleteMany({ generatedAssessmentId: { $in: ids } }).deletedCount : 0,
  examenesGenerados: ids.length ? dbx.examenesGenerados.deleteMany({ _id: { $in: ids } }).deletedCount : 0
};
const after = {
  examenesGenerados: dbx.examenesGenerados.countDocuments(),
  entregas: dbx.entregas.countDocuments(),
  calificaciones: dbx.calificaciones.countDocuments(),
  banderasRevision: dbx.banderasRevision.countDocuments(),
  escaneosOmrArchivados: dbx.escaneosOmrArchivados.countDocuments(),
  solicitudesRevisionAlumno: dbx.solicitudesRevisionAlumno.countDocuments(),
  componentesExamen: dbx.componentesExamen.countDocuments(),
  omrScanJobs: dbx.omrScanJobs.countDocuments()
};
printjson({ db: "mern_app_prod", before, deleted, after });
