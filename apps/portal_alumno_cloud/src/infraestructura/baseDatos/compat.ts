/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * compat
 *
 * Responsabilidad: Capa de compatibilidad Mongoose -> Prisma para el portal.
 * Permite usar métodos como find, findOne, create, etc. sobre Prisma Client.
 */
import { prisma } from './sqlite';

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
        if ('$in' in (val as any)) {
          where[targetKey] = { in: (val as any).$in };
        } else if ('$nin' in (val as any)) {
          where[targetKey] = { notIn: (val as any).$nin };
        } else if ('$ne' in (val as any)) {
          where[targetKey] = { not: (val as any).$ne };
        } else if (val instanceof Date) {
          where[targetKey] = val;
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
  private limitCount?: number;
  private memSort: any = undefined;

  constructor(delegate: any, query: any, isFindMany: boolean, fromDb: (r: any) => any) {
    this.delegate = delegate;
    this.originalQuery = query || {};
    this.where = convertQuery(this.originalQuery);
    this.isFindMany = isFindMany;
    this.fromDb = fromDb;
  }

  sort(sortSpec: any) {
    if (sortSpec) {
      const dbSort: any[] = [];
      const memSort: any = {};
      for (const [k, v] of Object.entries(sortSpec)) {
        if (k.includes('.')) {
          memSort[k] = v;
        } else {
          const mappedKey = k === '_id' ? 'id' : k;
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
    const memKeys = Object.keys(this.originalQuery).filter(k => k.includes('.'));

    let records: any[] = [];
    const queryParams: any = {
      where: this.where
    };
    if (this.order) {
      queryParams.orderBy = this.order;
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
          const parts = key.split('.');
          for (const part of parts) {
            current = current?.[part];
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
          const parts = key.split('.');
          for (const part of parts) {
            valA = valA?.[part];
            valB = valB?.[part];
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
}) {
  const delegate = (prisma as any)[prismaDelegateName];
  if (!delegate) {
    throw new Error(`Prisma delegate not found: ${prismaDelegateName}`);
  }
  const jsonFields = config.jsonFields || [];

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

  function fromDb(record: any) {
    if (!record) return null;
    const res = { ...record };
    if (res.id) {
      res._id = res.id;
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
      const data: any = {};
      for (const [k, v] of Object.entries(modelState)) {
        if (k === '_id' || k === 'id' || k === 'createdAt' || k === 'updatedAt' || typeof v === 'function') continue;
        if (jsonFields.includes(k)) {
          data[k] = v ? JSON.stringify(v) : null;
        } else {
          data[k] = v;
        }
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

  function toDb(data: any) {
    const rawData = { ...data };
    const res: any = {};
    for (const [k, v] of Object.entries(rawData)) {
      if (k === '_id') {
        res.id = String(v);
      } else {
        if (jsonFields.includes(k)) {
          res[k] = v ? JSON.stringify(v) : null;
        } else {
          res[k] = v;
        }
      }
    }
    return res;
  }

  return {
    async create(data: any) {
      const dbData = Array.isArray(data) ? data.map(toDb) : toDb(data);
      if (Array.isArray(dbData)) {
        const records = [];
        for (const item of dbData) {
          const rec = await delegate.create({ data: item });
          records.push(fromDb(rec));
        }
        return records;
      }
      const record = await delegate.create({ data: dbData });
      return fromDb(record);
    },
    insertMany(data: any, options?: any) {
      return this.create(data);
    },
    findOne(query: any) {
      return new MongooseQuery(delegate, query, false, fromDb);
    },
    findById(id: any) {
      return this.findOne({ _id: id });
    },
    find(query: any) {
      return new MongooseQuery(delegate, query, true, fromDb);
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
        if (options?.overwrite) {
          await delegate.delete({
            where: { id: record.id }
          });
          const createData = buildUpsertData(query, set);
          const created = await delegate.create({ data: toDb(createData) });
          return fromDb(created);
        }
        const mergedData = toDb(set);
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
      const mergedData = toDb(set);
      await delegate.update({
        where: { id: record.id },
        data: mergedData
      });
    },
    async updateMany(query: any, update: any) {
      const matchedRecords = await this.find(query).exec();
      for (const record of matchedRecords) {
        const mergedData = toDb(update.$set || update);
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
      return delegate.count({
        where: convertQuery(query)
      });
    },
    async deleteMany(query: any) {
      const matchedRecords = await this.find(query).exec();
      for (const record of matchedRecords) {
        await delegate.delete({
          where: { id: record.id }
        });
      }
    }
  };
}
