/**
 * compat
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, max-params, complexity */
/**
 * compat
 *
 * Responsabilidad: Capa de compatibilidad Mongoose -> Prisma compartida.
 * Permite usar métodos como find, findOne, create, etc. sobre Prisma Client.
 */
import { prisma } from '../infraestructura/baseDatos/sqlite';

export function convertQuery(query: any) {
  if (!query) return {};
  const where: any = {};
  for (const [key, val] of Object.entries(query)) {
    if (key.includes('.')) {
      // Ignorar campos con punto en Prisma, se filtrarán en memoria
      continue;
    }
    const targetKey = key === '_id' ? 'id' : key;
    if (val && typeof val === 'object') {
      try {
        if ('$in' in val) {
          where[targetKey] = { in: val.$in };
        } else if ('$nin' in val) {
          where[targetKey] = { notIn: val.$nin };
        } else if ('$ne' in val) {
          where[targetKey] = { not: val.$ne };
        } else {
          where[targetKey] = val;
        }
      } catch {
        where[targetKey] = val;
      }
    } else {
      where[targetKey] = val;
    }
  }
  return where;
}

class MongooseQuery {
  private delegate: any;
  private where: any;
  private order: any = undefined;
  private isFindMany: boolean;
  private fromDb: (r: any) => any;
  private originalQuery: any;
  private defaultInclude: any;
  private fieldMappings: Record<string, string>;
  private columns: string[];
  private modelName: string;
  private memSort: any = undefined;
  private limitCount?: number;

  constructor(delegate: any, query: any, isFindMany: boolean, fromDb: (r: any) => any, defaultInclude?: any, fieldMappings?: Record<string, string>, columns?: string[], modelName?: string) {
    this.delegate = delegate;
    this.originalQuery = query || {};
    this.fieldMappings = fieldMappings || {};
    this.columns = columns || [];
    this.modelName = modelName || '';
    
    // Split the query into database and in-memory parts
    const dbQuery: any = {};
    for (const [k, v] of Object.entries(this.originalQuery)) {
      const mappedKey = this.fieldMappings[k] || k;
      if (this.columns.length === 0 || this.columns.includes(mappedKey) || mappedKey === 'id') {
        dbQuery[mappedKey] = v;
      }
    }
    this.where = convertQuery(dbQuery);
    
    this.isFindMany = isFindMany;
    this.fromDb = fromDb;
    this.defaultInclude = defaultInclude;
  }

  sort(sortSpec: any) {
    if (sortSpec) {
      const dbSort: any[] = [];
      const memSort: any = {};
      for (const [k, v] of Object.entries(sortSpec)) {
        const mappedKey = this.fieldMappings[k] || k;
        if (k.includes('.') || (this.columns.length > 0 && !this.columns.includes(mappedKey) && mappedKey !== 'id')) {
          memSort[k] = v;
        } else {
          dbSort.push({
            [mappedKey]: v === -1 ? 'desc' : 'asc'
          });
        }
      }
      if (dbSort.length > 0) {
        this.order = dbSort;
      }
      if (Object.keys(memSort).length > 0) {
        this.memSort = memSort;
      }
    }
    return this;
  }

  select(fields: any) {
    return this;
  }

  populate(fields: any) {
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  async exec() {
    if (this.modelName === 'alumno' && (this.where.docenteId || this.originalQuery.docenteId)) {
      const docId = this.where.docenteId || this.originalQuery.docenteId;
      delete this.where.docenteId;
      if (!this.where.periodoId) {
        const periodos = await prisma.periodo.findMany({
          where: { docenteId: docId },
          select: { id: true }
        });
        const ids = periodos.map(p => p.id);
        this.where.periodoId = { in: ids };
      }
    }

    // Keys that need to be filtered in memory
    const memKeys = Object.keys(this.originalQuery).filter(k => {
      const mappedKey = this.fieldMappings[k] || k;
      return k.includes('.') || (this.columns.length > 0 && !this.columns.includes(mappedKey) && mappedKey !== 'id');
    });

    let records: any[] = [];
    const queryParams: any = {
      where: this.where,
      orderBy: this.order
    };
    if (this.defaultInclude) {
      queryParams.include = this.defaultInclude;
    }
    if (this.limitCount !== undefined && memKeys.length === 0) {
      queryParams.take = this.limitCount;
    }
    if (this.isFindMany || memKeys.length > 0) {
      records = await this.delegate.findMany(queryParams);
    } else {
      const record = await this.delegate.findFirst(queryParams);
      if (record) records = [record];
    }

    let wrapped = records.map(this.fromDb);

    if (memKeys.length > 0) {
      wrapped = wrapped.filter((r: any) => {
        for (const key of memKeys) {
          let current = r;
          if (key.includes('.')) {
            const parts = key.split('.');
            for (const part of parts) {
              current = current?.[part];
            }
          } else {
            current = r[key];
          }
          const expected = this.originalQuery[key];
          if (expected && typeof expected === 'object') {
            if ('$in' in expected) {
              if (!Array.isArray(expected.$in) || !expected.$in.includes(current)) {
                return false;
              }
            } else if ('$nin' in expected) {
              if (Array.isArray(expected.$nin) && expected.$nin.includes(current)) {
                return false;
              }
            } else {
              if (current !== expected) return false;
            }
          } else {
            if (current !== expected) {
              return false;
            }
          }
        }
        return true;
      });
    }

    if (this.memSort) {
      const sortEntries = Object.entries(this.memSort);
      wrapped.sort((a: any, b: any) => {
        for (const [key, dir] of sortEntries) {
          let valA = a;
          let valB = b;
          if (key.includes('.')) {
            const parts = key.split('.');
            for (const part of parts) {
              valA = valA?.[part];
              valB = valB?.[part];
            }
          } else {
            valA = a[key];
            valB = b[key];
          }
          if (valA === valB) continue;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          const factor = dir === -1 ? -1 : 1;
          return valA < valB ? -factor : factor;
        }
        return 0;
      });
    }

    if (this.limitCount !== undefined) {
      wrapped = wrapped.slice(0, this.limitCount);
    }

    if (this.isFindMany) {
      return wrapped;
    } else {
      return wrapped[0] || null;
    }
  }

  async lean() {
    const res = await this.exec();
    if (res && typeof res === 'object') {
      if (Array.isArray(res)) {
        return res.map(item => {
          if (item && typeof item === 'object') {
            const { save, ...leanItem } = item;
            return leanItem;
          }
          return item;
        });
      } else {
        const { save, ...leanItem } = res;
        return leanItem;
      }
    }
    return res;
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.exec().then(onfulfilled, onrejected);
  }
}

export function buildCompatModel(prismaDelegateName: string, config: {
  jsonFields?: string[];
  fieldMappings?: Record<string, string>; // Maps mongooseName -> prismaName
  defaultInclude?: any;
  columns?: string[];
}) {
  const delegate = (prisma as any)[prismaDelegateName];
  if (!delegate) {
    throw new Error(`Prisma delegate not found: ${prismaDelegateName}`);
  }
  const jsonFields = config.jsonFields || [];
  const fieldMappings = config.fieldMappings || {};
  const defaultInclude = config.defaultInclude;
  const columns = config.columns || [];
  const inverseMappings = Object.fromEntries(
    Object.entries(fieldMappings).map(([k, v]) => [v, k])
  );

  function expandDottedPaths(obj: any) {
    const res: any = {};
    for (const [key, val] of Object.entries(obj || {})) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = res;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
          }
          current = current[part];
        }
        current[parts[parts.length - 1]] = val;
      } else {
        res[key] = val;
      }
    }
    return res;
  }

  function deepMerge(target: any, source: any) {
    const res = { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        res[k] = deepMerge(res[k] || {}, v);
      } else {
        res[k] = v;
      }
    }
    return res;
  }

  function buildUpsertData(query: any, set: any) {
    const expandedQuery = expandDottedPaths(query);
    const expandedSet = expandDottedPaths(set);
    return deepMerge(expandedQuery, expandedSet);
  }

  function mergeJsonFields(record: any, update: any, prismaDelegateName: string) {
    const set = update.$set || update;
    const unset = update.$unset || {};
    const data = { ...toDb(set) };

    if (['integracionClassroom', 'mapeoClassroomEvidencia', 'examenRecoveryBundle', 'examenRecoveryManifest', 'omrScanJob'].includes(prismaDelegateName)) {
      const knownKeys = columns.length > 0 ? columns : ['id', 'docenteId', 'periodoId', 'alumnoId', 'courseId', 'courseWorkId', 'submissionId', 'evidenciaId', 'estado', 'metadata', 'createdAt', 'updatedAt', 'bundleHash', 'manifestHash', 'nombre', 'totalHojas', 'procesadas', 'errores', 'iniciadoEn', 'completadoEn'];
      const existingMetadata: any = {};
      for (const [k, v] of Object.entries(record || {})) {
        if (!knownKeys.includes(k) && k !== 'id' && typeof v !== 'function') {
          existingMetadata[k] = v;
        }
      }
      const newMetadata: any = {};
      for (const [k, v] of Object.entries(set)) {
        if (!knownKeys.includes(k) && k !== 'id') {
          newMetadata[k] = v;
        }
      }
      const mergedMetadata = { ...existingMetadata, ...newMetadata };
      for (const k of Object.keys(unset)) {
        if (!knownKeys.includes(k)) {
          delete mergedMetadata[k];
        }
      }
      data.metadata = JSON.stringify(mergedMetadata);
    }

    if (prismaDelegateName === 'bitacoraSyncClassroom') {
      const knownKeys = ['id', 'docenteId', 'periodoId', 'courseId', 'tipo', 'estado', 'resumen', 'errores', 'createdAt', 'updatedAt'];
      const existingResumen = record.resumen ? (typeof record.resumen === 'string' ? JSON.parse(record.resumen) : record.resumen) : {};
      const existingExtra: any = {};
      for (const [k, v] of Object.entries(record || {})) {
        if (!knownKeys.includes(k) && k !== 'id' && typeof v !== 'function' && k !== 'resumen') {
          existingExtra[k] = v;
        }
      }
      const newExtra: any = {};
      for (const [k, v] of Object.entries(set)) {
        if (!knownKeys.includes(k) && k !== 'id') {
          newExtra[k] = v;
        }
      }
      const mergedResumen = { 
        ...existingResumen, 
        ...(set.resumen ? (typeof set.resumen === 'string' ? JSON.parse(set.resumen) : set.resumen) : {}),
        __extra: { ...(existingResumen.__extra || {}), ...existingExtra, ...newExtra }
      };
      for (const k of Object.keys(unset)) {
        if (!knownKeys.includes(k)) {
          delete mergedResumen.__extra[k];
        }
      }
      data.resumen = JSON.stringify(mergedResumen);
    }

    for (const k of Object.keys(unset)) {
      const mappedKey = fieldMappings[k] || k;
      data[mappedKey] = null;
    }

    return data;
  }

  function fromDb(record: any) {
    if (!record) return null;
    const res = { ...record };
    if (res.id) {
      res._id = res.id;
    }
    // Apply field mappings from DB to model
    for (const [prismaName, modelName] of Object.entries(inverseMappings)) {
      res[modelName] = res[prismaName];
      delete res[prismaName];
    }
    for (const f of jsonFields) {
      if (res[f]) {
        try {
          res[f] = JSON.parse(res[f]);
        } catch {
          // ignore
        }
      }
    }
    if (prismaDelegateName === 'examenPlantilla' && Array.isArray(res.preguntas)) {
      const sorted = [...res.preguntas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      res.preguntasIds = sorted.map((p) => p.preguntaId);
    }
    if (prismaDelegateName === 'examenGenerado') {
      let ids: string[] = [];
      if (res.mapaVariante) {
        try {
          const mv = typeof res.mapaVariante === 'string' ? JSON.parse(res.mapaVariante) : res.mapaVariante;
          if (mv.versions) {
            const firstVer = Object.values(mv.versions)[0] as { ordenPreguntas?: string[] };
            if (firstVer && Array.isArray(firstVer.ordenPreguntas)) {
              ids = firstVer.ordenPreguntas;
            }
          } else if (Array.isArray(mv.ordenPreguntas)) {
            ids = mv.ordenPreguntas;
          }
        } catch {
          // ignore
        }
      }
      res.preguntasIds = ids;
    }
    if (['integracionClassroom', 'mapeoClassroomEvidencia', 'examenRecoveryBundle', 'examenRecoveryManifest', 'omrScanJob'].includes(prismaDelegateName) && res.metadata) {
      try {
        const metadataObj = typeof res.metadata === 'string' ? JSON.parse(res.metadata) : res.metadata;
        Object.assign(res, metadataObj);
        if (prismaDelegateName === 'examenRecoveryBundle') {
          res.bundle = metadataObj;
        }
        if (prismaDelegateName === 'examenRecoveryManifest') {
          res.manifest = metadataObj;
        }
        delete res.metadata;
      } catch {
        // ignore
      }
    }
    if (prismaDelegateName === 'omrScanJob') {
      if (!res.reviewResolutions) res.reviewResolutions = [];
      if (!res.pages) res.pages = [];
      if (!res.artifacts) res.artifacts = [];
    }
    if (prismaDelegateName === 'bitacoraSyncClassroom' && res.resumen) {
      try {
        const parsedResumen = typeof res.resumen === 'string' ? JSON.parse(res.resumen) : res.resumen;
        if (parsedResumen && parsedResumen.__extra) {
          Object.assign(res, parsedResumen.__extra);
          delete parsedResumen.__extra;
        }
        res.resumen = parsedResumen;
      } catch {
        // ignore
      }
    }
    // Implement save, toObject, and toJSON methods
    res.toObject = function() {
      const { save, toObject, toJSON, ...plain } = res;
      return plain;
    };
    res.toJSON = function() {
      const { save, toObject, toJSON, ...plain } = res;
      return plain;
    };
    res.save = async function() {
      const modelState = { ...res };
      // Apply field mappings from model to DB
      for (const [modelName, prismaName] of Object.entries(fieldMappings)) {
        modelState[prismaName] = modelState[modelName];
        delete modelState[modelName];
      }
      if (['integracionClassroom', 'mapeoClassroomEvidencia', 'examenRecoveryBundle', 'examenRecoveryManifest', 'omrScanJob'].includes(prismaDelegateName)) {
        const metadataObj: any = {};
        const knownKeys = columns.length > 0 ? columns : ['id', 'docenteId', 'googleSub', 'accessToken', 'refreshToken', 'tokenExpiraEn', 'activo', 'metadata', 'createdAt', 'updatedAt', 'periodoId', 'alumnoId', 'courseId', 'courseWorkId', 'submissionId', 'evidenciaId', 'estado', 'bundleHash', 'manifestHash', 'nombre', 'totalHojas', 'procesadas', 'errores', 'iniciadoEn', 'completadoEn'];
        for (const [k, v] of Object.entries(modelState)) {
          if (!knownKeys.includes(k) && k !== 'id' && typeof v !== 'function') {
            metadataObj[k] = v;
            delete modelState[k];
          }
        }
        modelState.metadata = metadataObj;
      }
      if (prismaDelegateName === 'bitacoraSyncClassroom') {
        const knownKeys = ['id', 'docenteId', 'periodoId', 'courseId', 'tipo', 'estado', 'resumen', 'errores', 'createdAt', 'updatedAt'];
        const extraObj: any = {};
        for (const [k, v] of Object.entries(modelState)) {
          if (!knownKeys.includes(k) && k !== 'id' && k !== 'resumen' && typeof v !== 'function') {
            extraObj[k] = v;
            delete modelState[k];
          }
        }
        let parsedResumen: any = {};
        if (modelState.resumen) {
          try {
            parsedResumen = typeof modelState.resumen === 'string' ? JSON.parse(modelState.resumen) : modelState.resumen;
          } catch {
            parsedResumen = modelState.resumen;
          }
        }
        parsedResumen.__extra = extraObj;
        modelState.resumen = parsedResumen;
      }

      const data: any = {};
      for (const [k, v] of Object.entries(modelState)) {
        if (k === '_id' || k === 'id' || k === 'createdAt' || k === 'updatedAt' || typeof v === 'function') continue;
        const mappedKey = fieldMappings[k] || k;
        if (columns.length > 0 && !columns.includes(mappedKey)) {
          continue;
        }
        if (jsonFields.includes(k)) {
          data[mappedKey] = v ? JSON.stringify(v) : null;
        } else if (Array.isArray(v)) {
          continue;
        } else {
          data[mappedKey] = v;
        }
      }
      if (prismaDelegateName === 'periodo') {
        if (data.nombre && !data.nombreNormalizado) {
          data.nombreNormalizado = String(data.nombre).replace(/\s+/g, ' ').trim().toLowerCase();
        }
        if (data.grupos === undefined || data.grupos === null) {
          data.grupos = '[]';
        }
      }
      if (prismaDelegateName === 'examenPlantilla') {
        if (data.titulo && !data.tituloNormalizado) {
          data.tituloNormalizado = String(data.titulo).trim().replace(/\s+/g, ' ').toLowerCase();
        }
      }
      if (prismaDelegateName === 'alumno') {
        if (!data.nombreCompleto) {
          data.nombreCompleto = `${data.nombres || ''} ${data.apellidos || ''}`.trim() || 'Sin Nombre';
        }
        if (!data.correo) {
          data.correo = `sin_correo_${data.matricula || Math.random().toString(36).substring(7)}@evaluapro.com`;
        }
        delete data.docenteId;
      }
      if (prismaDelegateName === 'docente' && !data.nombreCompleto) {
        data.nombreCompleto = `${data.nombres || ''} ${data.apellidos || ''}`.trim() || 'Sin Nombre';
      }
      if (prismaDelegateName === 'mapeoClassroomEvidencia' && !data.alumnoId) {
        data.alumnoId = 'todos';
      }
      const updated = await delegate.update({
        where: { id: res.id },
        data
      });
      Object.assign(res, fromDb(updated));
      return res;
    };
    return res;
  }

  function toDbOfRelation(item: any, parentField?: string): any {
    if (!item || typeof item !== 'object') return item;
    const res: any = {};
    for (const [k, v] of Object.entries(item)) {
      if (k === '_id') {
        res.id = String(v);
      } else if (Array.isArray(v)) {
        if (!jsonFields.includes(k)) {
          res[k] = {
            create: v.map((inner: any) => toDbOfRelation(inner, k))
          };
        } else {
          res[k] = v ? JSON.stringify(v) : null;
        }
      } else {
        if (parentField === 'versiones' && k === 'preguntaId') continue;
        if (parentField === 'opciones' && k === 'versionPreguntaId') continue;
        if (parentField === 'preguntas' && k === 'plantillaId') continue;
        if (parentField === 'registros' && k === 'sesionId') continue;
        res[k] = v;
      }
    }
    return res;
  }

  function toDb(data: any) {
    const rawData = { ...data };
    if (['integracionClassroom', 'mapeoClassroomEvidencia', 'examenRecoveryBundle', 'examenRecoveryManifest', 'omrScanJob'].includes(prismaDelegateName)) {
      const metadataObj: any = {};
      const knownKeys = columns.length > 0 ? columns : ['id', 'docenteId', 'googleSub', 'accessToken', 'refreshToken', 'tokenExpiraEn', 'activo', 'metadata', 'createdAt', 'updatedAt', 'periodoId', 'alumnoId', 'courseId', 'courseWorkId', 'submissionId', 'evidenciaId', 'estado', 'bundleHash', 'manifestHash', 'nombre', 'totalHojas', 'procesadas', 'errores', 'iniciadoEn', 'completadoEn'];
      for (const [k, v] of Object.entries(rawData)) {
        const mappedKey = fieldMappings[k] || k;
        if (!knownKeys.includes(mappedKey) && k !== '_id' && k !== 'id') {
          metadataObj[k] = v;
          delete rawData[k];
        }
      }
      rawData.metadata = metadataObj;
    }
    if (prismaDelegateName === 'bitacoraSyncClassroom') {
      const knownKeys = ['id', 'docenteId', 'periodoId', 'courseId', 'tipo', 'estado', 'resumen', 'errores', 'createdAt', 'updatedAt'];
      const extraObj: any = {};
      for (const [k, v] of Object.entries(rawData)) {
        const mappedKey = fieldMappings[k] || k;
        if (!knownKeys.includes(mappedKey) && k !== '_id' && k !== 'id' && k !== 'resumen') {
          extraObj[k] = v;
          delete rawData[k];
        }
      }
      let parsedResumen: any = {};
      if (rawData.resumen) {
        try {
          parsedResumen = typeof rawData.resumen === 'string' ? JSON.parse(rawData.resumen) : rawData.resumen;
        } catch {
          parsedResumen = rawData.resumen;
        }
      }
      parsedResumen.__extra = extraObj;
      rawData.resumen = parsedResumen;
    }

    const res: any = {};
    for (const [k, v] of Object.entries(rawData)) {
      if (k === '_id') {
        res.id = String(v);
      } else {
        const mappedKey = fieldMappings[k] || k;
        if (columns.length > 0 && !columns.includes(mappedKey) && mappedKey !== 'id') {
          continue;
        }
        if (jsonFields.includes(k)) {
          res[mappedKey] = v ? JSON.stringify(v) : null;
        } else if (Array.isArray(v)) {
          res[mappedKey] = {
            create: v.map((item: any) => toDbOfRelation(item, mappedKey))
          };
        } else {
          res[mappedKey] = v;
        }
      }
    }
    if (prismaDelegateName === 'periodo') {
      if (res.nombre && !res.nombreNormalizado) {
        res.nombreNormalizado = String(res.nombre).replace(/\s+/g, ' ').trim().toLowerCase();
      }
      if (res.grupos === undefined || res.grupos === null) {
        res.grupos = '[]';
      }
    }
    if (prismaDelegateName === 'examenPlantilla') {
      if (res.titulo && !res.tituloNormalizado) {
        res.tituloNormalizado = String(res.titulo).trim().replace(/\s+/g, ' ').toLowerCase();
      }
    }
    if (prismaDelegateName === 'alumno') {
      if (!res.nombreCompleto) {
        res.nombreCompleto = `${res.nombres || ''} ${res.apellidos || ''}`.trim() || 'Sin Nombre';
      }
      if (!res.correo) {
        res.correo = `sin_correo_${res.matricula || Math.random().toString(36).substring(7)}@evaluapro.com`;
      }
      delete res.docenteId;
    }
    if (prismaDelegateName === 'mapeoClassroomEvidencia' && !res.alumnoId) {
      res.alumnoId = 'todos';
    }
    if (prismaDelegateName === 'docente' && !res.nombreCompleto) {
      res.nombreCompleto = `${res.nombres || ''} ${res.apellidos || ''}`.trim() || 'Sin Nombre';
    }
    return res;
  }

  return {
    async create(data: any) {
      const createParams: any = {
        data: toDb(data)
      };
      if (defaultInclude) {
        createParams.include = defaultInclude;
      }
      const record = await delegate.create(createParams);
      return fromDb(record);
    },
    findOne(query: any) {
      // Convert query keys that are mapped
      const mappedQuery: any = {};
      for (const [k, v] of Object.entries(query || {})) {
        const mappedKey = fieldMappings[k] || k;
        mappedQuery[mappedKey] = v;
      }
      return new MongooseQuery(delegate, mappedQuery, false, fromDb, defaultInclude, fieldMappings, columns, prismaDelegateName);
    },
    findById(id: any) {
      return this.findOne({ _id: id });
    },
    find(query: any) {
      const mappedQuery: any = {};
      for (const [k, v] of Object.entries(query || {})) {
        const mappedKey = fieldMappings[k] || k;
        mappedQuery[mappedKey] = v;
      }
      return new MongooseQuery(delegate, mappedQuery, true, fromDb, defaultInclude, fieldMappings, columns, prismaDelegateName);
    },
    findOneAndUpdate(query: any, update: any, options?: any) {
      const promise = (async () => {
        const set = update.$set || update;
        const matchedRecords = await this.find(query).exec();
        const record = matchedRecords[0];
        if (!record) {
          if (options?.upsert) {
            const createData = buildUpsertData(query, set);
            const created = await delegate.create({ data: toDb(createData) });
            return fromDb(created);
          }
          return null;
        }
        const hasRelations = Object.entries(set).some(([k, v]) => {
          if (jsonFields.includes(k)) return false;
          const mappedKey = fieldMappings[k] || k;
          if (columns.length > 0 && columns.includes(mappedKey)) return false;
          return Array.isArray(v);
        });
        if (options?.overwrite || hasRelations) {
          await delegate.delete({
            where: { id: record.id }
          });
          const createData = buildUpsertData(query, set);
          const created = await delegate.create({ data: toDb(createData) });
          return fromDb(created);
        }
        const mergedData = mergeJsonFields(record, update, prismaDelegateName);
        const updated = await delegate.update({
          where: { id: record.id },
          data: mergedData
        });
        return fromDb(updated);
      })();

      return Object.assign(promise, {
        lean() {
          return promise;
        }
      });
    },
    findByIdAndUpdate(id: any, update: any, options?: any) {
      return this.findOneAndUpdate({ _id: id }, update, options);
    },
    async updateOne(query: any, update: any, options?: any) {
      const set = update.$set || update;
      const matchedRecords = await this.find(query).exec();
      const record = matchedRecords[0];
      if (!record) {
        if (options?.upsert) {
          const createData = buildUpsertData(query, set);
          await delegate.create({ data: toDb(createData) });
        }
        return;
      }
      const hasRelations = Object.entries(set).some(([k, v]) => {
        if (jsonFields.includes(k)) return false;
        const mappedKey = fieldMappings[k] || k;
        if (columns.length > 0 && columns.includes(mappedKey)) return false;
        return Array.isArray(v);
      });
      if (options?.overwrite || hasRelations) {
        await delegate.delete({
          where: { id: record.id }
        });
        const createData = buildUpsertData(query, set);
        await delegate.create({ data: toDb(createData) });
        return;
      }
      const mergedData = mergeJsonFields(record, update, prismaDelegateName);
      await delegate.update({
        where: { id: record.id },
        data: mergedData
      });
    },
    async updateMany(query: any, update: any) {
      const matchedRecords = await this.find(query).exec();
      for (const record of matchedRecords) {
        const mergedData = mergeJsonFields(record, update, prismaDelegateName);
        await delegate.update({
          where: { id: record.id },
          data: mergedData
        });
      }
    },
    async deleteOne(query: any) {
      const matchedRecords = await this.find(query).exec();
      const record = matchedRecords[0];
      if (record) {
        await delegate.delete({
          where: { id: record.id }
        });
      }
    },
    async countDocuments(query: any) {
      const mappedQuery: any = {};
      for (const [k, v] of Object.entries(query || {})) {
        const mappedKey = fieldMappings[k] || k;
        mappedQuery[mappedKey] = v;
      }
      const dbQuery: any = {};
      for (const [k, v] of Object.entries(mappedQuery)) {
        if (columns.length === 0 || columns.includes(k) || k === 'id') {
          dbQuery[k] = v;
        }
      }
      return delegate.count({
        where: convertQuery(dbQuery)
      });
    },
    async deleteMany(query: any) {
      const matchedRecords = await this.find(query).exec();
      for (const record of matchedRecords) {
        await delegate.delete({
          where: { id: record.id }
        });
      }
    },
    async insertMany(docs: any[]) {
      const records = [];
      for (const doc of docs) {
        const record = await delegate.create({
          data: toDb(doc)
        });
        records.push(fromDb(record));
      }
      return records;
    },
    async aggregate(pipeline: any[]) {
      const matchStage = pipeline.find(stage => '$match' in stage)?.$match || {};
      const groupStage = pipeline.find(stage => '$group' in stage)?.$group || {};
      
      const records = await this.find(matchStage).exec();
      
      const result: any = { _id: null };
      for (const [key, expr] of Object.entries(groupStage)) {
        if (key === '_id') continue;
        if (expr && typeof expr === 'object' && '$sum' in expr) {
          const sumExpr = expr.$sum;
          let sumValue = 0;
          if (sumExpr === 1) {
            sumValue = records.length;
          } else if (typeof sumExpr === 'string' && sumExpr.startsWith('$')) {
            const field = sumExpr.substring(1);
            sumValue = records.reduce((acc: number, r: any) => acc + Number(r[field] || 0), 0);
          } else if (sumExpr && typeof sumExpr === 'object' && '$ifNull' in sumExpr) {
            const ifNullExpr = sumExpr.$ifNull;
            const fieldExpr = Array.isArray(ifNullExpr) ? ifNullExpr[0] : null;
            if (typeof fieldExpr === 'string' && fieldExpr.startsWith('$')) {
              const field = fieldExpr.substring(1);
              sumValue = records.reduce((acc: number, r: any) => acc + Number(r[field] || 0), 0);
            }
          }
          result[key] = sumValue;
        }
      }
      return [result];
    }
  };
}
