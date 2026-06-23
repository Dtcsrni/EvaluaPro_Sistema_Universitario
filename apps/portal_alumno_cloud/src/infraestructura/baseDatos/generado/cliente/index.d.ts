
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model PerfilAlumno
 * 
 */
export type PerfilAlumno = $Result.DefaultSelection<Prisma.$PerfilAlumnoPayload>
/**
 * Model ResultadoAlumno
 * 
 */
export type ResultadoAlumno = $Result.DefaultSelection<Prisma.$ResultadoAlumnoPayload>
/**
 * Model MateriaAlumno
 * 
 */
export type MateriaAlumno = $Result.DefaultSelection<Prisma.$MateriaAlumnoPayload>
/**
 * Model AgendaAlumno
 * 
 */
export type AgendaAlumno = $Result.DefaultSelection<Prisma.$AgendaAlumnoPayload>
/**
 * Model AvisoAlumno
 * 
 */
export type AvisoAlumno = $Result.DefaultSelection<Prisma.$AvisoAlumnoPayload>
/**
 * Model HistorialAlumno
 * 
 */
export type HistorialAlumno = $Result.DefaultSelection<Prisma.$HistorialAlumnoPayload>
/**
 * Model CodigoAcceso
 * 
 */
export type CodigoAcceso = $Result.DefaultSelection<Prisma.$CodigoAccesoPayload>
/**
 * Model EventoUsoAlumno
 * 
 */
export type EventoUsoAlumno = $Result.DefaultSelection<Prisma.$EventoUsoAlumnoPayload>
/**
 * Model SesionAlumno
 * 
 */
export type SesionAlumno = $Result.DefaultSelection<Prisma.$SesionAlumnoPayload>
/**
 * Model SolicitudRevision
 * 
 */
export type SolicitudRevision = $Result.DefaultSelection<Prisma.$SolicitudRevisionPayload>
/**
 * Model PaqueteSyncDocente
 * 
 */
export type PaqueteSyncDocente = $Result.DefaultSelection<Prisma.$PaqueteSyncDocentePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more PerfilAlumnos
 * const perfilAlumnos = await prisma.perfilAlumno.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more PerfilAlumnos
   * const perfilAlumnos = await prisma.perfilAlumno.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.perfilAlumno`: Exposes CRUD operations for the **PerfilAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PerfilAlumnos
    * const perfilAlumnos = await prisma.perfilAlumno.findMany()
    * ```
    */
  get perfilAlumno(): Prisma.PerfilAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.resultadoAlumno`: Exposes CRUD operations for the **ResultadoAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ResultadoAlumnos
    * const resultadoAlumnos = await prisma.resultadoAlumno.findMany()
    * ```
    */
  get resultadoAlumno(): Prisma.ResultadoAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.materiaAlumno`: Exposes CRUD operations for the **MateriaAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MateriaAlumnos
    * const materiaAlumnos = await prisma.materiaAlumno.findMany()
    * ```
    */
  get materiaAlumno(): Prisma.MateriaAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.agendaAlumno`: Exposes CRUD operations for the **AgendaAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AgendaAlumnos
    * const agendaAlumnos = await prisma.agendaAlumno.findMany()
    * ```
    */
  get agendaAlumno(): Prisma.AgendaAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.avisoAlumno`: Exposes CRUD operations for the **AvisoAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AvisoAlumnos
    * const avisoAlumnos = await prisma.avisoAlumno.findMany()
    * ```
    */
  get avisoAlumno(): Prisma.AvisoAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.historialAlumno`: Exposes CRUD operations for the **HistorialAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more HistorialAlumnos
    * const historialAlumnos = await prisma.historialAlumno.findMany()
    * ```
    */
  get historialAlumno(): Prisma.HistorialAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.codigoAcceso`: Exposes CRUD operations for the **CodigoAcceso** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CodigoAccesos
    * const codigoAccesos = await prisma.codigoAcceso.findMany()
    * ```
    */
  get codigoAcceso(): Prisma.CodigoAccesoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.eventoUsoAlumno`: Exposes CRUD operations for the **EventoUsoAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more EventoUsoAlumnos
    * const eventoUsoAlumnos = await prisma.eventoUsoAlumno.findMany()
    * ```
    */
  get eventoUsoAlumno(): Prisma.EventoUsoAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.sesionAlumno`: Exposes CRUD operations for the **SesionAlumno** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SesionAlumnos
    * const sesionAlumnos = await prisma.sesionAlumno.findMany()
    * ```
    */
  get sesionAlumno(): Prisma.SesionAlumnoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.solicitudRevision`: Exposes CRUD operations for the **SolicitudRevision** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SolicitudRevisions
    * const solicitudRevisions = await prisma.solicitudRevision.findMany()
    * ```
    */
  get solicitudRevision(): Prisma.SolicitudRevisionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.paqueteSyncDocente`: Exposes CRUD operations for the **PaqueteSyncDocente** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PaqueteSyncDocentes
    * const paqueteSyncDocentes = await prisma.paqueteSyncDocente.findMany()
    * ```
    */
  get paqueteSyncDocente(): Prisma.PaqueteSyncDocenteDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    PerfilAlumno: 'PerfilAlumno',
    ResultadoAlumno: 'ResultadoAlumno',
    MateriaAlumno: 'MateriaAlumno',
    AgendaAlumno: 'AgendaAlumno',
    AvisoAlumno: 'AvisoAlumno',
    HistorialAlumno: 'HistorialAlumno',
    CodigoAcceso: 'CodigoAcceso',
    EventoUsoAlumno: 'EventoUsoAlumno',
    SesionAlumno: 'SesionAlumno',
    SolicitudRevision: 'SolicitudRevision',
    PaqueteSyncDocente: 'PaqueteSyncDocente'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "perfilAlumno" | "resultadoAlumno" | "materiaAlumno" | "agendaAlumno" | "avisoAlumno" | "historialAlumno" | "codigoAcceso" | "eventoUsoAlumno" | "sesionAlumno" | "solicitudRevision" | "paqueteSyncDocente"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      PerfilAlumno: {
        payload: Prisma.$PerfilAlumnoPayload<ExtArgs>
        fields: Prisma.PerfilAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PerfilAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PerfilAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>
          }
          findFirst: {
            args: Prisma.PerfilAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PerfilAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>
          }
          findMany: {
            args: Prisma.PerfilAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>[]
          }
          create: {
            args: Prisma.PerfilAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>
          }
          createMany: {
            args: Prisma.PerfilAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PerfilAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>[]
          }
          delete: {
            args: Prisma.PerfilAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>
          }
          update: {
            args: Prisma.PerfilAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.PerfilAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PerfilAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PerfilAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.PerfilAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PerfilAlumnoPayload>
          }
          aggregate: {
            args: Prisma.PerfilAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePerfilAlumno>
          }
          groupBy: {
            args: Prisma.PerfilAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<PerfilAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.PerfilAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<PerfilAlumnoCountAggregateOutputType> | number
          }
        }
      }
      ResultadoAlumno: {
        payload: Prisma.$ResultadoAlumnoPayload<ExtArgs>
        fields: Prisma.ResultadoAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ResultadoAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ResultadoAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>
          }
          findFirst: {
            args: Prisma.ResultadoAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ResultadoAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>
          }
          findMany: {
            args: Prisma.ResultadoAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>[]
          }
          create: {
            args: Prisma.ResultadoAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>
          }
          createMany: {
            args: Prisma.ResultadoAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ResultadoAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>[]
          }
          delete: {
            args: Prisma.ResultadoAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>
          }
          update: {
            args: Prisma.ResultadoAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.ResultadoAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ResultadoAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ResultadoAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.ResultadoAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResultadoAlumnoPayload>
          }
          aggregate: {
            args: Prisma.ResultadoAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateResultadoAlumno>
          }
          groupBy: {
            args: Prisma.ResultadoAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<ResultadoAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.ResultadoAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<ResultadoAlumnoCountAggregateOutputType> | number
          }
        }
      }
      MateriaAlumno: {
        payload: Prisma.$MateriaAlumnoPayload<ExtArgs>
        fields: Prisma.MateriaAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MateriaAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MateriaAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>
          }
          findFirst: {
            args: Prisma.MateriaAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MateriaAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>
          }
          findMany: {
            args: Prisma.MateriaAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>[]
          }
          create: {
            args: Prisma.MateriaAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>
          }
          createMany: {
            args: Prisma.MateriaAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MateriaAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>[]
          }
          delete: {
            args: Prisma.MateriaAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>
          }
          update: {
            args: Prisma.MateriaAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.MateriaAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MateriaAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MateriaAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.MateriaAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MateriaAlumnoPayload>
          }
          aggregate: {
            args: Prisma.MateriaAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMateriaAlumno>
          }
          groupBy: {
            args: Prisma.MateriaAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<MateriaAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.MateriaAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<MateriaAlumnoCountAggregateOutputType> | number
          }
        }
      }
      AgendaAlumno: {
        payload: Prisma.$AgendaAlumnoPayload<ExtArgs>
        fields: Prisma.AgendaAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AgendaAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AgendaAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>
          }
          findFirst: {
            args: Prisma.AgendaAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AgendaAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>
          }
          findMany: {
            args: Prisma.AgendaAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>[]
          }
          create: {
            args: Prisma.AgendaAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>
          }
          createMany: {
            args: Prisma.AgendaAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AgendaAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>[]
          }
          delete: {
            args: Prisma.AgendaAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>
          }
          update: {
            args: Prisma.AgendaAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.AgendaAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AgendaAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AgendaAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.AgendaAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgendaAlumnoPayload>
          }
          aggregate: {
            args: Prisma.AgendaAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAgendaAlumno>
          }
          groupBy: {
            args: Prisma.AgendaAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<AgendaAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.AgendaAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<AgendaAlumnoCountAggregateOutputType> | number
          }
        }
      }
      AvisoAlumno: {
        payload: Prisma.$AvisoAlumnoPayload<ExtArgs>
        fields: Prisma.AvisoAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AvisoAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AvisoAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>
          }
          findFirst: {
            args: Prisma.AvisoAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AvisoAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>
          }
          findMany: {
            args: Prisma.AvisoAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>[]
          }
          create: {
            args: Prisma.AvisoAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>
          }
          createMany: {
            args: Prisma.AvisoAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AvisoAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>[]
          }
          delete: {
            args: Prisma.AvisoAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>
          }
          update: {
            args: Prisma.AvisoAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.AvisoAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AvisoAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AvisoAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.AvisoAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AvisoAlumnoPayload>
          }
          aggregate: {
            args: Prisma.AvisoAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAvisoAlumno>
          }
          groupBy: {
            args: Prisma.AvisoAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<AvisoAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.AvisoAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<AvisoAlumnoCountAggregateOutputType> | number
          }
        }
      }
      HistorialAlumno: {
        payload: Prisma.$HistorialAlumnoPayload<ExtArgs>
        fields: Prisma.HistorialAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.HistorialAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.HistorialAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>
          }
          findFirst: {
            args: Prisma.HistorialAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.HistorialAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>
          }
          findMany: {
            args: Prisma.HistorialAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>[]
          }
          create: {
            args: Prisma.HistorialAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>
          }
          createMany: {
            args: Prisma.HistorialAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.HistorialAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>[]
          }
          delete: {
            args: Prisma.HistorialAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>
          }
          update: {
            args: Prisma.HistorialAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.HistorialAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.HistorialAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.HistorialAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.HistorialAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HistorialAlumnoPayload>
          }
          aggregate: {
            args: Prisma.HistorialAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateHistorialAlumno>
          }
          groupBy: {
            args: Prisma.HistorialAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<HistorialAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.HistorialAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<HistorialAlumnoCountAggregateOutputType> | number
          }
        }
      }
      CodigoAcceso: {
        payload: Prisma.$CodigoAccesoPayload<ExtArgs>
        fields: Prisma.CodigoAccesoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CodigoAccesoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CodigoAccesoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>
          }
          findFirst: {
            args: Prisma.CodigoAccesoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CodigoAccesoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>
          }
          findMany: {
            args: Prisma.CodigoAccesoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>[]
          }
          create: {
            args: Prisma.CodigoAccesoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>
          }
          createMany: {
            args: Prisma.CodigoAccesoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CodigoAccesoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>[]
          }
          delete: {
            args: Prisma.CodigoAccesoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>
          }
          update: {
            args: Prisma.CodigoAccesoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>
          }
          deleteMany: {
            args: Prisma.CodigoAccesoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CodigoAccesoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CodigoAccesoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>[]
          }
          upsert: {
            args: Prisma.CodigoAccesoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CodigoAccesoPayload>
          }
          aggregate: {
            args: Prisma.CodigoAccesoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCodigoAcceso>
          }
          groupBy: {
            args: Prisma.CodigoAccesoGroupByArgs<ExtArgs>
            result: $Utils.Optional<CodigoAccesoGroupByOutputType>[]
          }
          count: {
            args: Prisma.CodigoAccesoCountArgs<ExtArgs>
            result: $Utils.Optional<CodigoAccesoCountAggregateOutputType> | number
          }
        }
      }
      EventoUsoAlumno: {
        payload: Prisma.$EventoUsoAlumnoPayload<ExtArgs>
        fields: Prisma.EventoUsoAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EventoUsoAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EventoUsoAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>
          }
          findFirst: {
            args: Prisma.EventoUsoAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EventoUsoAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>
          }
          findMany: {
            args: Prisma.EventoUsoAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>[]
          }
          create: {
            args: Prisma.EventoUsoAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>
          }
          createMany: {
            args: Prisma.EventoUsoAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EventoUsoAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>[]
          }
          delete: {
            args: Prisma.EventoUsoAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>
          }
          update: {
            args: Prisma.EventoUsoAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.EventoUsoAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EventoUsoAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EventoUsoAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.EventoUsoAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventoUsoAlumnoPayload>
          }
          aggregate: {
            args: Prisma.EventoUsoAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEventoUsoAlumno>
          }
          groupBy: {
            args: Prisma.EventoUsoAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<EventoUsoAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.EventoUsoAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<EventoUsoAlumnoCountAggregateOutputType> | number
          }
        }
      }
      SesionAlumno: {
        payload: Prisma.$SesionAlumnoPayload<ExtArgs>
        fields: Prisma.SesionAlumnoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SesionAlumnoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SesionAlumnoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>
          }
          findFirst: {
            args: Prisma.SesionAlumnoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SesionAlumnoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>
          }
          findMany: {
            args: Prisma.SesionAlumnoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>[]
          }
          create: {
            args: Prisma.SesionAlumnoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>
          }
          createMany: {
            args: Prisma.SesionAlumnoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SesionAlumnoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>[]
          }
          delete: {
            args: Prisma.SesionAlumnoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>
          }
          update: {
            args: Prisma.SesionAlumnoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>
          }
          deleteMany: {
            args: Prisma.SesionAlumnoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SesionAlumnoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SesionAlumnoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>[]
          }
          upsert: {
            args: Prisma.SesionAlumnoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SesionAlumnoPayload>
          }
          aggregate: {
            args: Prisma.SesionAlumnoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSesionAlumno>
          }
          groupBy: {
            args: Prisma.SesionAlumnoGroupByArgs<ExtArgs>
            result: $Utils.Optional<SesionAlumnoGroupByOutputType>[]
          }
          count: {
            args: Prisma.SesionAlumnoCountArgs<ExtArgs>
            result: $Utils.Optional<SesionAlumnoCountAggregateOutputType> | number
          }
        }
      }
      SolicitudRevision: {
        payload: Prisma.$SolicitudRevisionPayload<ExtArgs>
        fields: Prisma.SolicitudRevisionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SolicitudRevisionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SolicitudRevisionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>
          }
          findFirst: {
            args: Prisma.SolicitudRevisionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SolicitudRevisionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>
          }
          findMany: {
            args: Prisma.SolicitudRevisionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>[]
          }
          create: {
            args: Prisma.SolicitudRevisionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>
          }
          createMany: {
            args: Prisma.SolicitudRevisionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SolicitudRevisionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>[]
          }
          delete: {
            args: Prisma.SolicitudRevisionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>
          }
          update: {
            args: Prisma.SolicitudRevisionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>
          }
          deleteMany: {
            args: Prisma.SolicitudRevisionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SolicitudRevisionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SolicitudRevisionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>[]
          }
          upsert: {
            args: Prisma.SolicitudRevisionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SolicitudRevisionPayload>
          }
          aggregate: {
            args: Prisma.SolicitudRevisionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSolicitudRevision>
          }
          groupBy: {
            args: Prisma.SolicitudRevisionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SolicitudRevisionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SolicitudRevisionCountArgs<ExtArgs>
            result: $Utils.Optional<SolicitudRevisionCountAggregateOutputType> | number
          }
        }
      }
      PaqueteSyncDocente: {
        payload: Prisma.$PaqueteSyncDocentePayload<ExtArgs>
        fields: Prisma.PaqueteSyncDocenteFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PaqueteSyncDocenteFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PaqueteSyncDocenteFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>
          }
          findFirst: {
            args: Prisma.PaqueteSyncDocenteFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PaqueteSyncDocenteFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>
          }
          findMany: {
            args: Prisma.PaqueteSyncDocenteFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>[]
          }
          create: {
            args: Prisma.PaqueteSyncDocenteCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>
          }
          createMany: {
            args: Prisma.PaqueteSyncDocenteCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PaqueteSyncDocenteCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>[]
          }
          delete: {
            args: Prisma.PaqueteSyncDocenteDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>
          }
          update: {
            args: Prisma.PaqueteSyncDocenteUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>
          }
          deleteMany: {
            args: Prisma.PaqueteSyncDocenteDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PaqueteSyncDocenteUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PaqueteSyncDocenteUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>[]
          }
          upsert: {
            args: Prisma.PaqueteSyncDocenteUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaqueteSyncDocentePayload>
          }
          aggregate: {
            args: Prisma.PaqueteSyncDocenteAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePaqueteSyncDocente>
          }
          groupBy: {
            args: Prisma.PaqueteSyncDocenteGroupByArgs<ExtArgs>
            result: $Utils.Optional<PaqueteSyncDocenteGroupByOutputType>[]
          }
          count: {
            args: Prisma.PaqueteSyncDocenteCountArgs<ExtArgs>
            result: $Utils.Optional<PaqueteSyncDocenteCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    perfilAlumno?: PerfilAlumnoOmit
    resultadoAlumno?: ResultadoAlumnoOmit
    materiaAlumno?: MateriaAlumnoOmit
    agendaAlumno?: AgendaAlumnoOmit
    avisoAlumno?: AvisoAlumnoOmit
    historialAlumno?: HistorialAlumnoOmit
    codigoAcceso?: CodigoAccesoOmit
    eventoUsoAlumno?: EventoUsoAlumnoOmit
    sesionAlumno?: SesionAlumnoOmit
    solicitudRevision?: SolicitudRevisionOmit
    paqueteSyncDocente?: PaqueteSyncDocenteOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model PerfilAlumno
   */

  export type AggregatePerfilAlumno = {
    _count: PerfilAlumnoCountAggregateOutputType | null
    _min: PerfilAlumnoMinAggregateOutputType | null
    _max: PerfilAlumnoMaxAggregateOutputType | null
  }

  export type PerfilAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    matricula: string | null
    nombreCompleto: string | null
    grupo: string | null
    docenteId: string | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PerfilAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    matricula: string | null
    nombreCompleto: string | null
    grupo: string | null
    docenteId: string | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PerfilAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    alumnoId: number
    matricula: number
    nombreCompleto: number
    grupo: number
    docenteId: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PerfilAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    matricula?: true
    nombreCompleto?: true
    grupo?: true
    docenteId?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PerfilAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    matricula?: true
    nombreCompleto?: true
    grupo?: true
    docenteId?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PerfilAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    matricula?: true
    nombreCompleto?: true
    grupo?: true
    docenteId?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PerfilAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PerfilAlumno to aggregate.
     */
    where?: PerfilAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PerfilAlumnos to fetch.
     */
    orderBy?: PerfilAlumnoOrderByWithRelationInput | PerfilAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PerfilAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PerfilAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PerfilAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PerfilAlumnos
    **/
    _count?: true | PerfilAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PerfilAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PerfilAlumnoMaxAggregateInputType
  }

  export type GetPerfilAlumnoAggregateType<T extends PerfilAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregatePerfilAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePerfilAlumno[P]>
      : GetScalarType<T[P], AggregatePerfilAlumno[P]>
  }




  export type PerfilAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PerfilAlumnoWhereInput
    orderBy?: PerfilAlumnoOrderByWithAggregationInput | PerfilAlumnoOrderByWithAggregationInput[]
    by: PerfilAlumnoScalarFieldEnum[] | PerfilAlumnoScalarFieldEnum
    having?: PerfilAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PerfilAlumnoCountAggregateInputType | true
    _min?: PerfilAlumnoMinAggregateInputType
    _max?: PerfilAlumnoMaxAggregateInputType
  }

  export type PerfilAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    alumnoId: string
    matricula: string
    nombreCompleto: string
    grupo: string | null
    docenteId: string | null
    metadata: string | null
    createdAt: Date
    updatedAt: Date
    _count: PerfilAlumnoCountAggregateOutputType | null
    _min: PerfilAlumnoMinAggregateOutputType | null
    _max: PerfilAlumnoMaxAggregateOutputType | null
  }

  type GetPerfilAlumnoGroupByPayload<T extends PerfilAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PerfilAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PerfilAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PerfilAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], PerfilAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type PerfilAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    docenteId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["perfilAlumno"]>

  export type PerfilAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    docenteId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["perfilAlumno"]>

  export type PerfilAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    docenteId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["perfilAlumno"]>

  export type PerfilAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    docenteId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PerfilAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "alumnoId" | "matricula" | "nombreCompleto" | "grupo" | "docenteId" | "metadata" | "createdAt" | "updatedAt", ExtArgs["result"]["perfilAlumno"]>

  export type $PerfilAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PerfilAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      alumnoId: string
      matricula: string
      nombreCompleto: string
      grupo: string | null
      docenteId: string | null
      metadata: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["perfilAlumno"]>
    composites: {}
  }

  type PerfilAlumnoGetPayload<S extends boolean | null | undefined | PerfilAlumnoDefaultArgs> = $Result.GetResult<Prisma.$PerfilAlumnoPayload, S>

  type PerfilAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PerfilAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PerfilAlumnoCountAggregateInputType | true
    }

  export interface PerfilAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PerfilAlumno'], meta: { name: 'PerfilAlumno' } }
    /**
     * Find zero or one PerfilAlumno that matches the filter.
     * @param {PerfilAlumnoFindUniqueArgs} args - Arguments to find a PerfilAlumno
     * @example
     * // Get one PerfilAlumno
     * const perfilAlumno = await prisma.perfilAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PerfilAlumnoFindUniqueArgs>(args: SelectSubset<T, PerfilAlumnoFindUniqueArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PerfilAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PerfilAlumnoFindUniqueOrThrowArgs} args - Arguments to find a PerfilAlumno
     * @example
     * // Get one PerfilAlumno
     * const perfilAlumno = await prisma.perfilAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PerfilAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, PerfilAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PerfilAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PerfilAlumnoFindFirstArgs} args - Arguments to find a PerfilAlumno
     * @example
     * // Get one PerfilAlumno
     * const perfilAlumno = await prisma.perfilAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PerfilAlumnoFindFirstArgs>(args?: SelectSubset<T, PerfilAlumnoFindFirstArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PerfilAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PerfilAlumnoFindFirstOrThrowArgs} args - Arguments to find a PerfilAlumno
     * @example
     * // Get one PerfilAlumno
     * const perfilAlumno = await prisma.perfilAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PerfilAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, PerfilAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PerfilAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PerfilAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PerfilAlumnos
     * const perfilAlumnos = await prisma.perfilAlumno.findMany()
     * 
     * // Get first 10 PerfilAlumnos
     * const perfilAlumnos = await prisma.perfilAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const perfilAlumnoWithIdOnly = await prisma.perfilAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PerfilAlumnoFindManyArgs>(args?: SelectSubset<T, PerfilAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PerfilAlumno.
     * @param {PerfilAlumnoCreateArgs} args - Arguments to create a PerfilAlumno.
     * @example
     * // Create one PerfilAlumno
     * const PerfilAlumno = await prisma.perfilAlumno.create({
     *   data: {
     *     // ... data to create a PerfilAlumno
     *   }
     * })
     * 
     */
    create<T extends PerfilAlumnoCreateArgs>(args: SelectSubset<T, PerfilAlumnoCreateArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PerfilAlumnos.
     * @param {PerfilAlumnoCreateManyArgs} args - Arguments to create many PerfilAlumnos.
     * @example
     * // Create many PerfilAlumnos
     * const perfilAlumno = await prisma.perfilAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PerfilAlumnoCreateManyArgs>(args?: SelectSubset<T, PerfilAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PerfilAlumnos and returns the data saved in the database.
     * @param {PerfilAlumnoCreateManyAndReturnArgs} args - Arguments to create many PerfilAlumnos.
     * @example
     * // Create many PerfilAlumnos
     * const perfilAlumno = await prisma.perfilAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PerfilAlumnos and only return the `id`
     * const perfilAlumnoWithIdOnly = await prisma.perfilAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PerfilAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, PerfilAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PerfilAlumno.
     * @param {PerfilAlumnoDeleteArgs} args - Arguments to delete one PerfilAlumno.
     * @example
     * // Delete one PerfilAlumno
     * const PerfilAlumno = await prisma.perfilAlumno.delete({
     *   where: {
     *     // ... filter to delete one PerfilAlumno
     *   }
     * })
     * 
     */
    delete<T extends PerfilAlumnoDeleteArgs>(args: SelectSubset<T, PerfilAlumnoDeleteArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PerfilAlumno.
     * @param {PerfilAlumnoUpdateArgs} args - Arguments to update one PerfilAlumno.
     * @example
     * // Update one PerfilAlumno
     * const perfilAlumno = await prisma.perfilAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PerfilAlumnoUpdateArgs>(args: SelectSubset<T, PerfilAlumnoUpdateArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PerfilAlumnos.
     * @param {PerfilAlumnoDeleteManyArgs} args - Arguments to filter PerfilAlumnos to delete.
     * @example
     * // Delete a few PerfilAlumnos
     * const { count } = await prisma.perfilAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PerfilAlumnoDeleteManyArgs>(args?: SelectSubset<T, PerfilAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PerfilAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PerfilAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PerfilAlumnos
     * const perfilAlumno = await prisma.perfilAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PerfilAlumnoUpdateManyArgs>(args: SelectSubset<T, PerfilAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PerfilAlumnos and returns the data updated in the database.
     * @param {PerfilAlumnoUpdateManyAndReturnArgs} args - Arguments to update many PerfilAlumnos.
     * @example
     * // Update many PerfilAlumnos
     * const perfilAlumno = await prisma.perfilAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PerfilAlumnos and only return the `id`
     * const perfilAlumnoWithIdOnly = await prisma.perfilAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PerfilAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, PerfilAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PerfilAlumno.
     * @param {PerfilAlumnoUpsertArgs} args - Arguments to update or create a PerfilAlumno.
     * @example
     * // Update or create a PerfilAlumno
     * const perfilAlumno = await prisma.perfilAlumno.upsert({
     *   create: {
     *     // ... data to create a PerfilAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PerfilAlumno we want to update
     *   }
     * })
     */
    upsert<T extends PerfilAlumnoUpsertArgs>(args: SelectSubset<T, PerfilAlumnoUpsertArgs<ExtArgs>>): Prisma__PerfilAlumnoClient<$Result.GetResult<Prisma.$PerfilAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PerfilAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PerfilAlumnoCountArgs} args - Arguments to filter PerfilAlumnos to count.
     * @example
     * // Count the number of PerfilAlumnos
     * const count = await prisma.perfilAlumno.count({
     *   where: {
     *     // ... the filter for the PerfilAlumnos we want to count
     *   }
     * })
    **/
    count<T extends PerfilAlumnoCountArgs>(
      args?: Subset<T, PerfilAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PerfilAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PerfilAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PerfilAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PerfilAlumnoAggregateArgs>(args: Subset<T, PerfilAlumnoAggregateArgs>): Prisma.PrismaPromise<GetPerfilAlumnoAggregateType<T>>

    /**
     * Group by PerfilAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PerfilAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PerfilAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PerfilAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: PerfilAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PerfilAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPerfilAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PerfilAlumno model
   */
  readonly fields: PerfilAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PerfilAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PerfilAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PerfilAlumno model
   */
  interface PerfilAlumnoFieldRefs {
    readonly id: FieldRef<"PerfilAlumno", 'String'>
    readonly periodoId: FieldRef<"PerfilAlumno", 'String'>
    readonly alumnoId: FieldRef<"PerfilAlumno", 'String'>
    readonly matricula: FieldRef<"PerfilAlumno", 'String'>
    readonly nombreCompleto: FieldRef<"PerfilAlumno", 'String'>
    readonly grupo: FieldRef<"PerfilAlumno", 'String'>
    readonly docenteId: FieldRef<"PerfilAlumno", 'String'>
    readonly metadata: FieldRef<"PerfilAlumno", 'String'>
    readonly createdAt: FieldRef<"PerfilAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"PerfilAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PerfilAlumno findUnique
   */
  export type PerfilAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which PerfilAlumno to fetch.
     */
    where: PerfilAlumnoWhereUniqueInput
  }

  /**
   * PerfilAlumno findUniqueOrThrow
   */
  export type PerfilAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which PerfilAlumno to fetch.
     */
    where: PerfilAlumnoWhereUniqueInput
  }

  /**
   * PerfilAlumno findFirst
   */
  export type PerfilAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which PerfilAlumno to fetch.
     */
    where?: PerfilAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PerfilAlumnos to fetch.
     */
    orderBy?: PerfilAlumnoOrderByWithRelationInput | PerfilAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PerfilAlumnos.
     */
    cursor?: PerfilAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PerfilAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PerfilAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PerfilAlumnos.
     */
    distinct?: PerfilAlumnoScalarFieldEnum | PerfilAlumnoScalarFieldEnum[]
  }

  /**
   * PerfilAlumno findFirstOrThrow
   */
  export type PerfilAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which PerfilAlumno to fetch.
     */
    where?: PerfilAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PerfilAlumnos to fetch.
     */
    orderBy?: PerfilAlumnoOrderByWithRelationInput | PerfilAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PerfilAlumnos.
     */
    cursor?: PerfilAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PerfilAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PerfilAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PerfilAlumnos.
     */
    distinct?: PerfilAlumnoScalarFieldEnum | PerfilAlumnoScalarFieldEnum[]
  }

  /**
   * PerfilAlumno findMany
   */
  export type PerfilAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which PerfilAlumnos to fetch.
     */
    where?: PerfilAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PerfilAlumnos to fetch.
     */
    orderBy?: PerfilAlumnoOrderByWithRelationInput | PerfilAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PerfilAlumnos.
     */
    cursor?: PerfilAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PerfilAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PerfilAlumnos.
     */
    skip?: number
    distinct?: PerfilAlumnoScalarFieldEnum | PerfilAlumnoScalarFieldEnum[]
  }

  /**
   * PerfilAlumno create
   */
  export type PerfilAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a PerfilAlumno.
     */
    data: XOR<PerfilAlumnoCreateInput, PerfilAlumnoUncheckedCreateInput>
  }

  /**
   * PerfilAlumno createMany
   */
  export type PerfilAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PerfilAlumnos.
     */
    data: PerfilAlumnoCreateManyInput | PerfilAlumnoCreateManyInput[]
  }

  /**
   * PerfilAlumno createManyAndReturn
   */
  export type PerfilAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many PerfilAlumnos.
     */
    data: PerfilAlumnoCreateManyInput | PerfilAlumnoCreateManyInput[]
  }

  /**
   * PerfilAlumno update
   */
  export type PerfilAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a PerfilAlumno.
     */
    data: XOR<PerfilAlumnoUpdateInput, PerfilAlumnoUncheckedUpdateInput>
    /**
     * Choose, which PerfilAlumno to update.
     */
    where: PerfilAlumnoWhereUniqueInput
  }

  /**
   * PerfilAlumno updateMany
   */
  export type PerfilAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PerfilAlumnos.
     */
    data: XOR<PerfilAlumnoUpdateManyMutationInput, PerfilAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which PerfilAlumnos to update
     */
    where?: PerfilAlumnoWhereInput
    /**
     * Limit how many PerfilAlumnos to update.
     */
    limit?: number
  }

  /**
   * PerfilAlumno updateManyAndReturn
   */
  export type PerfilAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update PerfilAlumnos.
     */
    data: XOR<PerfilAlumnoUpdateManyMutationInput, PerfilAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which PerfilAlumnos to update
     */
    where?: PerfilAlumnoWhereInput
    /**
     * Limit how many PerfilAlumnos to update.
     */
    limit?: number
  }

  /**
   * PerfilAlumno upsert
   */
  export type PerfilAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the PerfilAlumno to update in case it exists.
     */
    where: PerfilAlumnoWhereUniqueInput
    /**
     * In case the PerfilAlumno found by the `where` argument doesn't exist, create a new PerfilAlumno with this data.
     */
    create: XOR<PerfilAlumnoCreateInput, PerfilAlumnoUncheckedCreateInput>
    /**
     * In case the PerfilAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PerfilAlumnoUpdateInput, PerfilAlumnoUncheckedUpdateInput>
  }

  /**
   * PerfilAlumno delete
   */
  export type PerfilAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
    /**
     * Filter which PerfilAlumno to delete.
     */
    where: PerfilAlumnoWhereUniqueInput
  }

  /**
   * PerfilAlumno deleteMany
   */
  export type PerfilAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PerfilAlumnos to delete
     */
    where?: PerfilAlumnoWhereInput
    /**
     * Limit how many PerfilAlumnos to delete.
     */
    limit?: number
  }

  /**
   * PerfilAlumno without action
   */
  export type PerfilAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PerfilAlumno
     */
    select?: PerfilAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PerfilAlumno
     */
    omit?: PerfilAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model ResultadoAlumno
   */

  export type AggregateResultadoAlumno = {
    _count: ResultadoAlumnoCountAggregateOutputType | null
    _avg: ResultadoAlumnoAvgAggregateOutputType | null
    _sum: ResultadoAlumnoSumAggregateOutputType | null
    _min: ResultadoAlumnoMinAggregateOutputType | null
    _max: ResultadoAlumnoMaxAggregateOutputType | null
  }

  export type ResultadoAlumnoAvgAggregateOutputType = {
    totalReactivos: number | null
    aciertos: number | null
    versionPolitica: number | null
    bloqueContinuaDecimal: number | null
    bloqueExamenesDecimal: number | null
    finalDecimal: number | null
    finalRedondeada: number | null
  }

  export type ResultadoAlumnoSumAggregateOutputType = {
    totalReactivos: number | null
    aciertos: number | null
    versionPolitica: number | null
    bloqueContinuaDecimal: number | null
    bloqueExamenesDecimal: number | null
    finalDecimal: number | null
    finalRedondeada: number | null
  }

  export type ResultadoAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    docenteId: string | null
    alumnoId: string | null
    examenGeneradoId: string | null
    matricula: string | null
    nombreCompleto: string | null
    grupo: string | null
    folio: string | null
    tipoExamen: string | null
    totalReactivos: number | null
    aciertos: number | null
    calificacionExamenFinalTexto: string | null
    calificacionParcialTexto: string | null
    calificacionGlobalTexto: string | null
    evaluacionContinuaTexto: string | null
    proyectoTexto: string | null
    politicaId: string | null
    versionPolitica: number | null
    componentesExamen: string | null
    bloqueContinuaDecimal: number | null
    bloqueExamenesDecimal: number | null
    finalDecimal: number | null
    finalRedondeada: number | null
    respuestasDetectadas: string | null
    comparativaRespuestas: string | null
    omrCapturas: string | null
    omrAuditoria: string | null
    banderas: string | null
    pdfComprimidoBase64: string | null
    publicadoEn: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ResultadoAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    docenteId: string | null
    alumnoId: string | null
    examenGeneradoId: string | null
    matricula: string | null
    nombreCompleto: string | null
    grupo: string | null
    folio: string | null
    tipoExamen: string | null
    totalReactivos: number | null
    aciertos: number | null
    calificacionExamenFinalTexto: string | null
    calificacionParcialTexto: string | null
    calificacionGlobalTexto: string | null
    evaluacionContinuaTexto: string | null
    proyectoTexto: string | null
    politicaId: string | null
    versionPolitica: number | null
    componentesExamen: string | null
    bloqueContinuaDecimal: number | null
    bloqueExamenesDecimal: number | null
    finalDecimal: number | null
    finalRedondeada: number | null
    respuestasDetectadas: string | null
    comparativaRespuestas: string | null
    omrCapturas: string | null
    omrAuditoria: string | null
    banderas: string | null
    pdfComprimidoBase64: string | null
    publicadoEn: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ResultadoAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    docenteId: number
    alumnoId: number
    examenGeneradoId: number
    matricula: number
    nombreCompleto: number
    grupo: number
    folio: number
    tipoExamen: number
    totalReactivos: number
    aciertos: number
    calificacionExamenFinalTexto: number
    calificacionParcialTexto: number
    calificacionGlobalTexto: number
    evaluacionContinuaTexto: number
    proyectoTexto: number
    politicaId: number
    versionPolitica: number
    componentesExamen: number
    bloqueContinuaDecimal: number
    bloqueExamenesDecimal: number
    finalDecimal: number
    finalRedondeada: number
    respuestasDetectadas: number
    comparativaRespuestas: number
    omrCapturas: number
    omrAuditoria: number
    banderas: number
    pdfComprimidoBase64: number
    publicadoEn: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ResultadoAlumnoAvgAggregateInputType = {
    totalReactivos?: true
    aciertos?: true
    versionPolitica?: true
    bloqueContinuaDecimal?: true
    bloqueExamenesDecimal?: true
    finalDecimal?: true
    finalRedondeada?: true
  }

  export type ResultadoAlumnoSumAggregateInputType = {
    totalReactivos?: true
    aciertos?: true
    versionPolitica?: true
    bloqueContinuaDecimal?: true
    bloqueExamenesDecimal?: true
    finalDecimal?: true
    finalRedondeada?: true
  }

  export type ResultadoAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    docenteId?: true
    alumnoId?: true
    examenGeneradoId?: true
    matricula?: true
    nombreCompleto?: true
    grupo?: true
    folio?: true
    tipoExamen?: true
    totalReactivos?: true
    aciertos?: true
    calificacionExamenFinalTexto?: true
    calificacionParcialTexto?: true
    calificacionGlobalTexto?: true
    evaluacionContinuaTexto?: true
    proyectoTexto?: true
    politicaId?: true
    versionPolitica?: true
    componentesExamen?: true
    bloqueContinuaDecimal?: true
    bloqueExamenesDecimal?: true
    finalDecimal?: true
    finalRedondeada?: true
    respuestasDetectadas?: true
    comparativaRespuestas?: true
    omrCapturas?: true
    omrAuditoria?: true
    banderas?: true
    pdfComprimidoBase64?: true
    publicadoEn?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ResultadoAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    docenteId?: true
    alumnoId?: true
    examenGeneradoId?: true
    matricula?: true
    nombreCompleto?: true
    grupo?: true
    folio?: true
    tipoExamen?: true
    totalReactivos?: true
    aciertos?: true
    calificacionExamenFinalTexto?: true
    calificacionParcialTexto?: true
    calificacionGlobalTexto?: true
    evaluacionContinuaTexto?: true
    proyectoTexto?: true
    politicaId?: true
    versionPolitica?: true
    componentesExamen?: true
    bloqueContinuaDecimal?: true
    bloqueExamenesDecimal?: true
    finalDecimal?: true
    finalRedondeada?: true
    respuestasDetectadas?: true
    comparativaRespuestas?: true
    omrCapturas?: true
    omrAuditoria?: true
    banderas?: true
    pdfComprimidoBase64?: true
    publicadoEn?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ResultadoAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    docenteId?: true
    alumnoId?: true
    examenGeneradoId?: true
    matricula?: true
    nombreCompleto?: true
    grupo?: true
    folio?: true
    tipoExamen?: true
    totalReactivos?: true
    aciertos?: true
    calificacionExamenFinalTexto?: true
    calificacionParcialTexto?: true
    calificacionGlobalTexto?: true
    evaluacionContinuaTexto?: true
    proyectoTexto?: true
    politicaId?: true
    versionPolitica?: true
    componentesExamen?: true
    bloqueContinuaDecimal?: true
    bloqueExamenesDecimal?: true
    finalDecimal?: true
    finalRedondeada?: true
    respuestasDetectadas?: true
    comparativaRespuestas?: true
    omrCapturas?: true
    omrAuditoria?: true
    banderas?: true
    pdfComprimidoBase64?: true
    publicadoEn?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ResultadoAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ResultadoAlumno to aggregate.
     */
    where?: ResultadoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResultadoAlumnos to fetch.
     */
    orderBy?: ResultadoAlumnoOrderByWithRelationInput | ResultadoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ResultadoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResultadoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResultadoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ResultadoAlumnos
    **/
    _count?: true | ResultadoAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ResultadoAlumnoAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ResultadoAlumnoSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ResultadoAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ResultadoAlumnoMaxAggregateInputType
  }

  export type GetResultadoAlumnoAggregateType<T extends ResultadoAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregateResultadoAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateResultadoAlumno[P]>
      : GetScalarType<T[P], AggregateResultadoAlumno[P]>
  }




  export type ResultadoAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ResultadoAlumnoWhereInput
    orderBy?: ResultadoAlumnoOrderByWithAggregationInput | ResultadoAlumnoOrderByWithAggregationInput[]
    by: ResultadoAlumnoScalarFieldEnum[] | ResultadoAlumnoScalarFieldEnum
    having?: ResultadoAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ResultadoAlumnoCountAggregateInputType | true
    _avg?: ResultadoAlumnoAvgAggregateInputType
    _sum?: ResultadoAlumnoSumAggregateInputType
    _min?: ResultadoAlumnoMinAggregateInputType
    _max?: ResultadoAlumnoMaxAggregateInputType
  }

  export type ResultadoAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId: string | null
    matricula: string
    nombreCompleto: string
    grupo: string | null
    folio: string
    tipoExamen: string
    totalReactivos: number | null
    aciertos: number | null
    calificacionExamenFinalTexto: string
    calificacionParcialTexto: string | null
    calificacionGlobalTexto: string | null
    evaluacionContinuaTexto: string | null
    proyectoTexto: string | null
    politicaId: string | null
    versionPolitica: number | null
    componentesExamen: string | null
    bloqueContinuaDecimal: number | null
    bloqueExamenesDecimal: number | null
    finalDecimal: number | null
    finalRedondeada: number | null
    respuestasDetectadas: string | null
    comparativaRespuestas: string | null
    omrCapturas: string | null
    omrAuditoria: string | null
    banderas: string | null
    pdfComprimidoBase64: string | null
    publicadoEn: Date
    createdAt: Date
    updatedAt: Date
    _count: ResultadoAlumnoCountAggregateOutputType | null
    _avg: ResultadoAlumnoAvgAggregateOutputType | null
    _sum: ResultadoAlumnoSumAggregateOutputType | null
    _min: ResultadoAlumnoMinAggregateOutputType | null
    _max: ResultadoAlumnoMaxAggregateOutputType | null
  }

  type GetResultadoAlumnoGroupByPayload<T extends ResultadoAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ResultadoAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ResultadoAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ResultadoAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], ResultadoAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type ResultadoAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    folio?: boolean
    tipoExamen?: boolean
    totalReactivos?: boolean
    aciertos?: boolean
    calificacionExamenFinalTexto?: boolean
    calificacionParcialTexto?: boolean
    calificacionGlobalTexto?: boolean
    evaluacionContinuaTexto?: boolean
    proyectoTexto?: boolean
    politicaId?: boolean
    versionPolitica?: boolean
    componentesExamen?: boolean
    bloqueContinuaDecimal?: boolean
    bloqueExamenesDecimal?: boolean
    finalDecimal?: boolean
    finalRedondeada?: boolean
    respuestasDetectadas?: boolean
    comparativaRespuestas?: boolean
    omrCapturas?: boolean
    omrAuditoria?: boolean
    banderas?: boolean
    pdfComprimidoBase64?: boolean
    publicadoEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["resultadoAlumno"]>

  export type ResultadoAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    folio?: boolean
    tipoExamen?: boolean
    totalReactivos?: boolean
    aciertos?: boolean
    calificacionExamenFinalTexto?: boolean
    calificacionParcialTexto?: boolean
    calificacionGlobalTexto?: boolean
    evaluacionContinuaTexto?: boolean
    proyectoTexto?: boolean
    politicaId?: boolean
    versionPolitica?: boolean
    componentesExamen?: boolean
    bloqueContinuaDecimal?: boolean
    bloqueExamenesDecimal?: boolean
    finalDecimal?: boolean
    finalRedondeada?: boolean
    respuestasDetectadas?: boolean
    comparativaRespuestas?: boolean
    omrCapturas?: boolean
    omrAuditoria?: boolean
    banderas?: boolean
    pdfComprimidoBase64?: boolean
    publicadoEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["resultadoAlumno"]>

  export type ResultadoAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    folio?: boolean
    tipoExamen?: boolean
    totalReactivos?: boolean
    aciertos?: boolean
    calificacionExamenFinalTexto?: boolean
    calificacionParcialTexto?: boolean
    calificacionGlobalTexto?: boolean
    evaluacionContinuaTexto?: boolean
    proyectoTexto?: boolean
    politicaId?: boolean
    versionPolitica?: boolean
    componentesExamen?: boolean
    bloqueContinuaDecimal?: boolean
    bloqueExamenesDecimal?: boolean
    finalDecimal?: boolean
    finalRedondeada?: boolean
    respuestasDetectadas?: boolean
    comparativaRespuestas?: boolean
    omrCapturas?: boolean
    omrAuditoria?: boolean
    banderas?: boolean
    pdfComprimidoBase64?: boolean
    publicadoEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["resultadoAlumno"]>

  export type ResultadoAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    matricula?: boolean
    nombreCompleto?: boolean
    grupo?: boolean
    folio?: boolean
    tipoExamen?: boolean
    totalReactivos?: boolean
    aciertos?: boolean
    calificacionExamenFinalTexto?: boolean
    calificacionParcialTexto?: boolean
    calificacionGlobalTexto?: boolean
    evaluacionContinuaTexto?: boolean
    proyectoTexto?: boolean
    politicaId?: boolean
    versionPolitica?: boolean
    componentesExamen?: boolean
    bloqueContinuaDecimal?: boolean
    bloqueExamenesDecimal?: boolean
    finalDecimal?: boolean
    finalRedondeada?: boolean
    respuestasDetectadas?: boolean
    comparativaRespuestas?: boolean
    omrCapturas?: boolean
    omrAuditoria?: boolean
    banderas?: boolean
    pdfComprimidoBase64?: boolean
    publicadoEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ResultadoAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "docenteId" | "alumnoId" | "examenGeneradoId" | "matricula" | "nombreCompleto" | "grupo" | "folio" | "tipoExamen" | "totalReactivos" | "aciertos" | "calificacionExamenFinalTexto" | "calificacionParcialTexto" | "calificacionGlobalTexto" | "evaluacionContinuaTexto" | "proyectoTexto" | "politicaId" | "versionPolitica" | "componentesExamen" | "bloqueContinuaDecimal" | "bloqueExamenesDecimal" | "finalDecimal" | "finalRedondeada" | "respuestasDetectadas" | "comparativaRespuestas" | "omrCapturas" | "omrAuditoria" | "banderas" | "pdfComprimidoBase64" | "publicadoEn" | "createdAt" | "updatedAt", ExtArgs["result"]["resultadoAlumno"]>

  export type $ResultadoAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ResultadoAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      docenteId: string
      alumnoId: string
      examenGeneradoId: string | null
      matricula: string
      nombreCompleto: string
      grupo: string | null
      folio: string
      tipoExamen: string
      totalReactivos: number | null
      aciertos: number | null
      calificacionExamenFinalTexto: string
      calificacionParcialTexto: string | null
      calificacionGlobalTexto: string | null
      evaluacionContinuaTexto: string | null
      proyectoTexto: string | null
      politicaId: string | null
      versionPolitica: number | null
      componentesExamen: string | null
      bloqueContinuaDecimal: number | null
      bloqueExamenesDecimal: number | null
      finalDecimal: number | null
      finalRedondeada: number | null
      respuestasDetectadas: string | null
      comparativaRespuestas: string | null
      omrCapturas: string | null
      omrAuditoria: string | null
      banderas: string | null
      pdfComprimidoBase64: string | null
      publicadoEn: Date
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["resultadoAlumno"]>
    composites: {}
  }

  type ResultadoAlumnoGetPayload<S extends boolean | null | undefined | ResultadoAlumnoDefaultArgs> = $Result.GetResult<Prisma.$ResultadoAlumnoPayload, S>

  type ResultadoAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ResultadoAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ResultadoAlumnoCountAggregateInputType | true
    }

  export interface ResultadoAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ResultadoAlumno'], meta: { name: 'ResultadoAlumno' } }
    /**
     * Find zero or one ResultadoAlumno that matches the filter.
     * @param {ResultadoAlumnoFindUniqueArgs} args - Arguments to find a ResultadoAlumno
     * @example
     * // Get one ResultadoAlumno
     * const resultadoAlumno = await prisma.resultadoAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ResultadoAlumnoFindUniqueArgs>(args: SelectSubset<T, ResultadoAlumnoFindUniqueArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ResultadoAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ResultadoAlumnoFindUniqueOrThrowArgs} args - Arguments to find a ResultadoAlumno
     * @example
     * // Get one ResultadoAlumno
     * const resultadoAlumno = await prisma.resultadoAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ResultadoAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, ResultadoAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ResultadoAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResultadoAlumnoFindFirstArgs} args - Arguments to find a ResultadoAlumno
     * @example
     * // Get one ResultadoAlumno
     * const resultadoAlumno = await prisma.resultadoAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ResultadoAlumnoFindFirstArgs>(args?: SelectSubset<T, ResultadoAlumnoFindFirstArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ResultadoAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResultadoAlumnoFindFirstOrThrowArgs} args - Arguments to find a ResultadoAlumno
     * @example
     * // Get one ResultadoAlumno
     * const resultadoAlumno = await prisma.resultadoAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ResultadoAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, ResultadoAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ResultadoAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResultadoAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ResultadoAlumnos
     * const resultadoAlumnos = await prisma.resultadoAlumno.findMany()
     * 
     * // Get first 10 ResultadoAlumnos
     * const resultadoAlumnos = await prisma.resultadoAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const resultadoAlumnoWithIdOnly = await prisma.resultadoAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ResultadoAlumnoFindManyArgs>(args?: SelectSubset<T, ResultadoAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ResultadoAlumno.
     * @param {ResultadoAlumnoCreateArgs} args - Arguments to create a ResultadoAlumno.
     * @example
     * // Create one ResultadoAlumno
     * const ResultadoAlumno = await prisma.resultadoAlumno.create({
     *   data: {
     *     // ... data to create a ResultadoAlumno
     *   }
     * })
     * 
     */
    create<T extends ResultadoAlumnoCreateArgs>(args: SelectSubset<T, ResultadoAlumnoCreateArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ResultadoAlumnos.
     * @param {ResultadoAlumnoCreateManyArgs} args - Arguments to create many ResultadoAlumnos.
     * @example
     * // Create many ResultadoAlumnos
     * const resultadoAlumno = await prisma.resultadoAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ResultadoAlumnoCreateManyArgs>(args?: SelectSubset<T, ResultadoAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ResultadoAlumnos and returns the data saved in the database.
     * @param {ResultadoAlumnoCreateManyAndReturnArgs} args - Arguments to create many ResultadoAlumnos.
     * @example
     * // Create many ResultadoAlumnos
     * const resultadoAlumno = await prisma.resultadoAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ResultadoAlumnos and only return the `id`
     * const resultadoAlumnoWithIdOnly = await prisma.resultadoAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ResultadoAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, ResultadoAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ResultadoAlumno.
     * @param {ResultadoAlumnoDeleteArgs} args - Arguments to delete one ResultadoAlumno.
     * @example
     * // Delete one ResultadoAlumno
     * const ResultadoAlumno = await prisma.resultadoAlumno.delete({
     *   where: {
     *     // ... filter to delete one ResultadoAlumno
     *   }
     * })
     * 
     */
    delete<T extends ResultadoAlumnoDeleteArgs>(args: SelectSubset<T, ResultadoAlumnoDeleteArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ResultadoAlumno.
     * @param {ResultadoAlumnoUpdateArgs} args - Arguments to update one ResultadoAlumno.
     * @example
     * // Update one ResultadoAlumno
     * const resultadoAlumno = await prisma.resultadoAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ResultadoAlumnoUpdateArgs>(args: SelectSubset<T, ResultadoAlumnoUpdateArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ResultadoAlumnos.
     * @param {ResultadoAlumnoDeleteManyArgs} args - Arguments to filter ResultadoAlumnos to delete.
     * @example
     * // Delete a few ResultadoAlumnos
     * const { count } = await prisma.resultadoAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ResultadoAlumnoDeleteManyArgs>(args?: SelectSubset<T, ResultadoAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ResultadoAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResultadoAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ResultadoAlumnos
     * const resultadoAlumno = await prisma.resultadoAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ResultadoAlumnoUpdateManyArgs>(args: SelectSubset<T, ResultadoAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ResultadoAlumnos and returns the data updated in the database.
     * @param {ResultadoAlumnoUpdateManyAndReturnArgs} args - Arguments to update many ResultadoAlumnos.
     * @example
     * // Update many ResultadoAlumnos
     * const resultadoAlumno = await prisma.resultadoAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ResultadoAlumnos and only return the `id`
     * const resultadoAlumnoWithIdOnly = await prisma.resultadoAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ResultadoAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, ResultadoAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ResultadoAlumno.
     * @param {ResultadoAlumnoUpsertArgs} args - Arguments to update or create a ResultadoAlumno.
     * @example
     * // Update or create a ResultadoAlumno
     * const resultadoAlumno = await prisma.resultadoAlumno.upsert({
     *   create: {
     *     // ... data to create a ResultadoAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ResultadoAlumno we want to update
     *   }
     * })
     */
    upsert<T extends ResultadoAlumnoUpsertArgs>(args: SelectSubset<T, ResultadoAlumnoUpsertArgs<ExtArgs>>): Prisma__ResultadoAlumnoClient<$Result.GetResult<Prisma.$ResultadoAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ResultadoAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResultadoAlumnoCountArgs} args - Arguments to filter ResultadoAlumnos to count.
     * @example
     * // Count the number of ResultadoAlumnos
     * const count = await prisma.resultadoAlumno.count({
     *   where: {
     *     // ... the filter for the ResultadoAlumnos we want to count
     *   }
     * })
    **/
    count<T extends ResultadoAlumnoCountArgs>(
      args?: Subset<T, ResultadoAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ResultadoAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ResultadoAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResultadoAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ResultadoAlumnoAggregateArgs>(args: Subset<T, ResultadoAlumnoAggregateArgs>): Prisma.PrismaPromise<GetResultadoAlumnoAggregateType<T>>

    /**
     * Group by ResultadoAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResultadoAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ResultadoAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ResultadoAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: ResultadoAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ResultadoAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetResultadoAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ResultadoAlumno model
   */
  readonly fields: ResultadoAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ResultadoAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ResultadoAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ResultadoAlumno model
   */
  interface ResultadoAlumnoFieldRefs {
    readonly id: FieldRef<"ResultadoAlumno", 'String'>
    readonly periodoId: FieldRef<"ResultadoAlumno", 'String'>
    readonly docenteId: FieldRef<"ResultadoAlumno", 'String'>
    readonly alumnoId: FieldRef<"ResultadoAlumno", 'String'>
    readonly examenGeneradoId: FieldRef<"ResultadoAlumno", 'String'>
    readonly matricula: FieldRef<"ResultadoAlumno", 'String'>
    readonly nombreCompleto: FieldRef<"ResultadoAlumno", 'String'>
    readonly grupo: FieldRef<"ResultadoAlumno", 'String'>
    readonly folio: FieldRef<"ResultadoAlumno", 'String'>
    readonly tipoExamen: FieldRef<"ResultadoAlumno", 'String'>
    readonly totalReactivos: FieldRef<"ResultadoAlumno", 'Int'>
    readonly aciertos: FieldRef<"ResultadoAlumno", 'Int'>
    readonly calificacionExamenFinalTexto: FieldRef<"ResultadoAlumno", 'String'>
    readonly calificacionParcialTexto: FieldRef<"ResultadoAlumno", 'String'>
    readonly calificacionGlobalTexto: FieldRef<"ResultadoAlumno", 'String'>
    readonly evaluacionContinuaTexto: FieldRef<"ResultadoAlumno", 'String'>
    readonly proyectoTexto: FieldRef<"ResultadoAlumno", 'String'>
    readonly politicaId: FieldRef<"ResultadoAlumno", 'String'>
    readonly versionPolitica: FieldRef<"ResultadoAlumno", 'Int'>
    readonly componentesExamen: FieldRef<"ResultadoAlumno", 'String'>
    readonly bloqueContinuaDecimal: FieldRef<"ResultadoAlumno", 'Float'>
    readonly bloqueExamenesDecimal: FieldRef<"ResultadoAlumno", 'Float'>
    readonly finalDecimal: FieldRef<"ResultadoAlumno", 'Float'>
    readonly finalRedondeada: FieldRef<"ResultadoAlumno", 'Float'>
    readonly respuestasDetectadas: FieldRef<"ResultadoAlumno", 'String'>
    readonly comparativaRespuestas: FieldRef<"ResultadoAlumno", 'String'>
    readonly omrCapturas: FieldRef<"ResultadoAlumno", 'String'>
    readonly omrAuditoria: FieldRef<"ResultadoAlumno", 'String'>
    readonly banderas: FieldRef<"ResultadoAlumno", 'String'>
    readonly pdfComprimidoBase64: FieldRef<"ResultadoAlumno", 'String'>
    readonly publicadoEn: FieldRef<"ResultadoAlumno", 'DateTime'>
    readonly createdAt: FieldRef<"ResultadoAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"ResultadoAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ResultadoAlumno findUnique
   */
  export type ResultadoAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which ResultadoAlumno to fetch.
     */
    where: ResultadoAlumnoWhereUniqueInput
  }

  /**
   * ResultadoAlumno findUniqueOrThrow
   */
  export type ResultadoAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which ResultadoAlumno to fetch.
     */
    where: ResultadoAlumnoWhereUniqueInput
  }

  /**
   * ResultadoAlumno findFirst
   */
  export type ResultadoAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which ResultadoAlumno to fetch.
     */
    where?: ResultadoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResultadoAlumnos to fetch.
     */
    orderBy?: ResultadoAlumnoOrderByWithRelationInput | ResultadoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ResultadoAlumnos.
     */
    cursor?: ResultadoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResultadoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResultadoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ResultadoAlumnos.
     */
    distinct?: ResultadoAlumnoScalarFieldEnum | ResultadoAlumnoScalarFieldEnum[]
  }

  /**
   * ResultadoAlumno findFirstOrThrow
   */
  export type ResultadoAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which ResultadoAlumno to fetch.
     */
    where?: ResultadoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResultadoAlumnos to fetch.
     */
    orderBy?: ResultadoAlumnoOrderByWithRelationInput | ResultadoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ResultadoAlumnos.
     */
    cursor?: ResultadoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResultadoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResultadoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ResultadoAlumnos.
     */
    distinct?: ResultadoAlumnoScalarFieldEnum | ResultadoAlumnoScalarFieldEnum[]
  }

  /**
   * ResultadoAlumno findMany
   */
  export type ResultadoAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which ResultadoAlumnos to fetch.
     */
    where?: ResultadoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResultadoAlumnos to fetch.
     */
    orderBy?: ResultadoAlumnoOrderByWithRelationInput | ResultadoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ResultadoAlumnos.
     */
    cursor?: ResultadoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResultadoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResultadoAlumnos.
     */
    skip?: number
    distinct?: ResultadoAlumnoScalarFieldEnum | ResultadoAlumnoScalarFieldEnum[]
  }

  /**
   * ResultadoAlumno create
   */
  export type ResultadoAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a ResultadoAlumno.
     */
    data: XOR<ResultadoAlumnoCreateInput, ResultadoAlumnoUncheckedCreateInput>
  }

  /**
   * ResultadoAlumno createMany
   */
  export type ResultadoAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ResultadoAlumnos.
     */
    data: ResultadoAlumnoCreateManyInput | ResultadoAlumnoCreateManyInput[]
  }

  /**
   * ResultadoAlumno createManyAndReturn
   */
  export type ResultadoAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many ResultadoAlumnos.
     */
    data: ResultadoAlumnoCreateManyInput | ResultadoAlumnoCreateManyInput[]
  }

  /**
   * ResultadoAlumno update
   */
  export type ResultadoAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a ResultadoAlumno.
     */
    data: XOR<ResultadoAlumnoUpdateInput, ResultadoAlumnoUncheckedUpdateInput>
    /**
     * Choose, which ResultadoAlumno to update.
     */
    where: ResultadoAlumnoWhereUniqueInput
  }

  /**
   * ResultadoAlumno updateMany
   */
  export type ResultadoAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ResultadoAlumnos.
     */
    data: XOR<ResultadoAlumnoUpdateManyMutationInput, ResultadoAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which ResultadoAlumnos to update
     */
    where?: ResultadoAlumnoWhereInput
    /**
     * Limit how many ResultadoAlumnos to update.
     */
    limit?: number
  }

  /**
   * ResultadoAlumno updateManyAndReturn
   */
  export type ResultadoAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update ResultadoAlumnos.
     */
    data: XOR<ResultadoAlumnoUpdateManyMutationInput, ResultadoAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which ResultadoAlumnos to update
     */
    where?: ResultadoAlumnoWhereInput
    /**
     * Limit how many ResultadoAlumnos to update.
     */
    limit?: number
  }

  /**
   * ResultadoAlumno upsert
   */
  export type ResultadoAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the ResultadoAlumno to update in case it exists.
     */
    where: ResultadoAlumnoWhereUniqueInput
    /**
     * In case the ResultadoAlumno found by the `where` argument doesn't exist, create a new ResultadoAlumno with this data.
     */
    create: XOR<ResultadoAlumnoCreateInput, ResultadoAlumnoUncheckedCreateInput>
    /**
     * In case the ResultadoAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ResultadoAlumnoUpdateInput, ResultadoAlumnoUncheckedUpdateInput>
  }

  /**
   * ResultadoAlumno delete
   */
  export type ResultadoAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
    /**
     * Filter which ResultadoAlumno to delete.
     */
    where: ResultadoAlumnoWhereUniqueInput
  }

  /**
   * ResultadoAlumno deleteMany
   */
  export type ResultadoAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ResultadoAlumnos to delete
     */
    where?: ResultadoAlumnoWhereInput
    /**
     * Limit how many ResultadoAlumnos to delete.
     */
    limit?: number
  }

  /**
   * ResultadoAlumno without action
   */
  export type ResultadoAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResultadoAlumno
     */
    select?: ResultadoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResultadoAlumno
     */
    omit?: ResultadoAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model MateriaAlumno
   */

  export type AggregateMateriaAlumno = {
    _count: MateriaAlumnoCountAggregateOutputType | null
    _min: MateriaAlumnoMinAggregateOutputType | null
    _max: MateriaAlumnoMaxAggregateOutputType | null
  }

  export type MateriaAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    materiaId: string | null
    nombre: string | null
    docente: string | null
    estado: string | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MateriaAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    materiaId: string | null
    nombre: string | null
    docente: string | null
    estado: string | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MateriaAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    alumnoId: number
    materiaId: number
    nombre: number
    docente: number
    estado: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MateriaAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    materiaId?: true
    nombre?: true
    docente?: true
    estado?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MateriaAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    materiaId?: true
    nombre?: true
    docente?: true
    estado?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MateriaAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    materiaId?: true
    nombre?: true
    docente?: true
    estado?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MateriaAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MateriaAlumno to aggregate.
     */
    where?: MateriaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MateriaAlumnos to fetch.
     */
    orderBy?: MateriaAlumnoOrderByWithRelationInput | MateriaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MateriaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MateriaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MateriaAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MateriaAlumnos
    **/
    _count?: true | MateriaAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MateriaAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MateriaAlumnoMaxAggregateInputType
  }

  export type GetMateriaAlumnoAggregateType<T extends MateriaAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregateMateriaAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMateriaAlumno[P]>
      : GetScalarType<T[P], AggregateMateriaAlumno[P]>
  }




  export type MateriaAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MateriaAlumnoWhereInput
    orderBy?: MateriaAlumnoOrderByWithAggregationInput | MateriaAlumnoOrderByWithAggregationInput[]
    by: MateriaAlumnoScalarFieldEnum[] | MateriaAlumnoScalarFieldEnum
    having?: MateriaAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MateriaAlumnoCountAggregateInputType | true
    _min?: MateriaAlumnoMinAggregateInputType
    _max?: MateriaAlumnoMaxAggregateInputType
  }

  export type MateriaAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    alumnoId: string
    materiaId: string
    nombre: string
    docente: string | null
    estado: string
    metadata: string | null
    createdAt: Date
    updatedAt: Date
    _count: MateriaAlumnoCountAggregateOutputType | null
    _min: MateriaAlumnoMinAggregateOutputType | null
    _max: MateriaAlumnoMaxAggregateOutputType | null
  }

  type GetMateriaAlumnoGroupByPayload<T extends MateriaAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MateriaAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MateriaAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MateriaAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], MateriaAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type MateriaAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    materiaId?: boolean
    nombre?: boolean
    docente?: boolean
    estado?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["materiaAlumno"]>

  export type MateriaAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    materiaId?: boolean
    nombre?: boolean
    docente?: boolean
    estado?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["materiaAlumno"]>

  export type MateriaAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    materiaId?: boolean
    nombre?: boolean
    docente?: boolean
    estado?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["materiaAlumno"]>

  export type MateriaAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    materiaId?: boolean
    nombre?: boolean
    docente?: boolean
    estado?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MateriaAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "alumnoId" | "materiaId" | "nombre" | "docente" | "estado" | "metadata" | "createdAt" | "updatedAt", ExtArgs["result"]["materiaAlumno"]>

  export type $MateriaAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MateriaAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      alumnoId: string
      materiaId: string
      nombre: string
      docente: string | null
      estado: string
      metadata: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["materiaAlumno"]>
    composites: {}
  }

  type MateriaAlumnoGetPayload<S extends boolean | null | undefined | MateriaAlumnoDefaultArgs> = $Result.GetResult<Prisma.$MateriaAlumnoPayload, S>

  type MateriaAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MateriaAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MateriaAlumnoCountAggregateInputType | true
    }

  export interface MateriaAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MateriaAlumno'], meta: { name: 'MateriaAlumno' } }
    /**
     * Find zero or one MateriaAlumno that matches the filter.
     * @param {MateriaAlumnoFindUniqueArgs} args - Arguments to find a MateriaAlumno
     * @example
     * // Get one MateriaAlumno
     * const materiaAlumno = await prisma.materiaAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MateriaAlumnoFindUniqueArgs>(args: SelectSubset<T, MateriaAlumnoFindUniqueArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MateriaAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MateriaAlumnoFindUniqueOrThrowArgs} args - Arguments to find a MateriaAlumno
     * @example
     * // Get one MateriaAlumno
     * const materiaAlumno = await prisma.materiaAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MateriaAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, MateriaAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MateriaAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MateriaAlumnoFindFirstArgs} args - Arguments to find a MateriaAlumno
     * @example
     * // Get one MateriaAlumno
     * const materiaAlumno = await prisma.materiaAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MateriaAlumnoFindFirstArgs>(args?: SelectSubset<T, MateriaAlumnoFindFirstArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MateriaAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MateriaAlumnoFindFirstOrThrowArgs} args - Arguments to find a MateriaAlumno
     * @example
     * // Get one MateriaAlumno
     * const materiaAlumno = await prisma.materiaAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MateriaAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, MateriaAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MateriaAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MateriaAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MateriaAlumnos
     * const materiaAlumnos = await prisma.materiaAlumno.findMany()
     * 
     * // Get first 10 MateriaAlumnos
     * const materiaAlumnos = await prisma.materiaAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const materiaAlumnoWithIdOnly = await prisma.materiaAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MateriaAlumnoFindManyArgs>(args?: SelectSubset<T, MateriaAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MateriaAlumno.
     * @param {MateriaAlumnoCreateArgs} args - Arguments to create a MateriaAlumno.
     * @example
     * // Create one MateriaAlumno
     * const MateriaAlumno = await prisma.materiaAlumno.create({
     *   data: {
     *     // ... data to create a MateriaAlumno
     *   }
     * })
     * 
     */
    create<T extends MateriaAlumnoCreateArgs>(args: SelectSubset<T, MateriaAlumnoCreateArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MateriaAlumnos.
     * @param {MateriaAlumnoCreateManyArgs} args - Arguments to create many MateriaAlumnos.
     * @example
     * // Create many MateriaAlumnos
     * const materiaAlumno = await prisma.materiaAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MateriaAlumnoCreateManyArgs>(args?: SelectSubset<T, MateriaAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MateriaAlumnos and returns the data saved in the database.
     * @param {MateriaAlumnoCreateManyAndReturnArgs} args - Arguments to create many MateriaAlumnos.
     * @example
     * // Create many MateriaAlumnos
     * const materiaAlumno = await prisma.materiaAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MateriaAlumnos and only return the `id`
     * const materiaAlumnoWithIdOnly = await prisma.materiaAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MateriaAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, MateriaAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MateriaAlumno.
     * @param {MateriaAlumnoDeleteArgs} args - Arguments to delete one MateriaAlumno.
     * @example
     * // Delete one MateriaAlumno
     * const MateriaAlumno = await prisma.materiaAlumno.delete({
     *   where: {
     *     // ... filter to delete one MateriaAlumno
     *   }
     * })
     * 
     */
    delete<T extends MateriaAlumnoDeleteArgs>(args: SelectSubset<T, MateriaAlumnoDeleteArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MateriaAlumno.
     * @param {MateriaAlumnoUpdateArgs} args - Arguments to update one MateriaAlumno.
     * @example
     * // Update one MateriaAlumno
     * const materiaAlumno = await prisma.materiaAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MateriaAlumnoUpdateArgs>(args: SelectSubset<T, MateriaAlumnoUpdateArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MateriaAlumnos.
     * @param {MateriaAlumnoDeleteManyArgs} args - Arguments to filter MateriaAlumnos to delete.
     * @example
     * // Delete a few MateriaAlumnos
     * const { count } = await prisma.materiaAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MateriaAlumnoDeleteManyArgs>(args?: SelectSubset<T, MateriaAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MateriaAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MateriaAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MateriaAlumnos
     * const materiaAlumno = await prisma.materiaAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MateriaAlumnoUpdateManyArgs>(args: SelectSubset<T, MateriaAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MateriaAlumnos and returns the data updated in the database.
     * @param {MateriaAlumnoUpdateManyAndReturnArgs} args - Arguments to update many MateriaAlumnos.
     * @example
     * // Update many MateriaAlumnos
     * const materiaAlumno = await prisma.materiaAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MateriaAlumnos and only return the `id`
     * const materiaAlumnoWithIdOnly = await prisma.materiaAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends MateriaAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, MateriaAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MateriaAlumno.
     * @param {MateriaAlumnoUpsertArgs} args - Arguments to update or create a MateriaAlumno.
     * @example
     * // Update or create a MateriaAlumno
     * const materiaAlumno = await prisma.materiaAlumno.upsert({
     *   create: {
     *     // ... data to create a MateriaAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MateriaAlumno we want to update
     *   }
     * })
     */
    upsert<T extends MateriaAlumnoUpsertArgs>(args: SelectSubset<T, MateriaAlumnoUpsertArgs<ExtArgs>>): Prisma__MateriaAlumnoClient<$Result.GetResult<Prisma.$MateriaAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MateriaAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MateriaAlumnoCountArgs} args - Arguments to filter MateriaAlumnos to count.
     * @example
     * // Count the number of MateriaAlumnos
     * const count = await prisma.materiaAlumno.count({
     *   where: {
     *     // ... the filter for the MateriaAlumnos we want to count
     *   }
     * })
    **/
    count<T extends MateriaAlumnoCountArgs>(
      args?: Subset<T, MateriaAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MateriaAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MateriaAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MateriaAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MateriaAlumnoAggregateArgs>(args: Subset<T, MateriaAlumnoAggregateArgs>): Prisma.PrismaPromise<GetMateriaAlumnoAggregateType<T>>

    /**
     * Group by MateriaAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MateriaAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MateriaAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MateriaAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: MateriaAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MateriaAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMateriaAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MateriaAlumno model
   */
  readonly fields: MateriaAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MateriaAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MateriaAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MateriaAlumno model
   */
  interface MateriaAlumnoFieldRefs {
    readonly id: FieldRef<"MateriaAlumno", 'String'>
    readonly periodoId: FieldRef<"MateriaAlumno", 'String'>
    readonly alumnoId: FieldRef<"MateriaAlumno", 'String'>
    readonly materiaId: FieldRef<"MateriaAlumno", 'String'>
    readonly nombre: FieldRef<"MateriaAlumno", 'String'>
    readonly docente: FieldRef<"MateriaAlumno", 'String'>
    readonly estado: FieldRef<"MateriaAlumno", 'String'>
    readonly metadata: FieldRef<"MateriaAlumno", 'String'>
    readonly createdAt: FieldRef<"MateriaAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"MateriaAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MateriaAlumno findUnique
   */
  export type MateriaAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which MateriaAlumno to fetch.
     */
    where: MateriaAlumnoWhereUniqueInput
  }

  /**
   * MateriaAlumno findUniqueOrThrow
   */
  export type MateriaAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which MateriaAlumno to fetch.
     */
    where: MateriaAlumnoWhereUniqueInput
  }

  /**
   * MateriaAlumno findFirst
   */
  export type MateriaAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which MateriaAlumno to fetch.
     */
    where?: MateriaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MateriaAlumnos to fetch.
     */
    orderBy?: MateriaAlumnoOrderByWithRelationInput | MateriaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MateriaAlumnos.
     */
    cursor?: MateriaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MateriaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MateriaAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MateriaAlumnos.
     */
    distinct?: MateriaAlumnoScalarFieldEnum | MateriaAlumnoScalarFieldEnum[]
  }

  /**
   * MateriaAlumno findFirstOrThrow
   */
  export type MateriaAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which MateriaAlumno to fetch.
     */
    where?: MateriaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MateriaAlumnos to fetch.
     */
    orderBy?: MateriaAlumnoOrderByWithRelationInput | MateriaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MateriaAlumnos.
     */
    cursor?: MateriaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MateriaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MateriaAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MateriaAlumnos.
     */
    distinct?: MateriaAlumnoScalarFieldEnum | MateriaAlumnoScalarFieldEnum[]
  }

  /**
   * MateriaAlumno findMany
   */
  export type MateriaAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which MateriaAlumnos to fetch.
     */
    where?: MateriaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MateriaAlumnos to fetch.
     */
    orderBy?: MateriaAlumnoOrderByWithRelationInput | MateriaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MateriaAlumnos.
     */
    cursor?: MateriaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MateriaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MateriaAlumnos.
     */
    skip?: number
    distinct?: MateriaAlumnoScalarFieldEnum | MateriaAlumnoScalarFieldEnum[]
  }

  /**
   * MateriaAlumno create
   */
  export type MateriaAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a MateriaAlumno.
     */
    data: XOR<MateriaAlumnoCreateInput, MateriaAlumnoUncheckedCreateInput>
  }

  /**
   * MateriaAlumno createMany
   */
  export type MateriaAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MateriaAlumnos.
     */
    data: MateriaAlumnoCreateManyInput | MateriaAlumnoCreateManyInput[]
  }

  /**
   * MateriaAlumno createManyAndReturn
   */
  export type MateriaAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many MateriaAlumnos.
     */
    data: MateriaAlumnoCreateManyInput | MateriaAlumnoCreateManyInput[]
  }

  /**
   * MateriaAlumno update
   */
  export type MateriaAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a MateriaAlumno.
     */
    data: XOR<MateriaAlumnoUpdateInput, MateriaAlumnoUncheckedUpdateInput>
    /**
     * Choose, which MateriaAlumno to update.
     */
    where: MateriaAlumnoWhereUniqueInput
  }

  /**
   * MateriaAlumno updateMany
   */
  export type MateriaAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MateriaAlumnos.
     */
    data: XOR<MateriaAlumnoUpdateManyMutationInput, MateriaAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which MateriaAlumnos to update
     */
    where?: MateriaAlumnoWhereInput
    /**
     * Limit how many MateriaAlumnos to update.
     */
    limit?: number
  }

  /**
   * MateriaAlumno updateManyAndReturn
   */
  export type MateriaAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update MateriaAlumnos.
     */
    data: XOR<MateriaAlumnoUpdateManyMutationInput, MateriaAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which MateriaAlumnos to update
     */
    where?: MateriaAlumnoWhereInput
    /**
     * Limit how many MateriaAlumnos to update.
     */
    limit?: number
  }

  /**
   * MateriaAlumno upsert
   */
  export type MateriaAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the MateriaAlumno to update in case it exists.
     */
    where: MateriaAlumnoWhereUniqueInput
    /**
     * In case the MateriaAlumno found by the `where` argument doesn't exist, create a new MateriaAlumno with this data.
     */
    create: XOR<MateriaAlumnoCreateInput, MateriaAlumnoUncheckedCreateInput>
    /**
     * In case the MateriaAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MateriaAlumnoUpdateInput, MateriaAlumnoUncheckedUpdateInput>
  }

  /**
   * MateriaAlumno delete
   */
  export type MateriaAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
    /**
     * Filter which MateriaAlumno to delete.
     */
    where: MateriaAlumnoWhereUniqueInput
  }

  /**
   * MateriaAlumno deleteMany
   */
  export type MateriaAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MateriaAlumnos to delete
     */
    where?: MateriaAlumnoWhereInput
    /**
     * Limit how many MateriaAlumnos to delete.
     */
    limit?: number
  }

  /**
   * MateriaAlumno without action
   */
  export type MateriaAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MateriaAlumno
     */
    select?: MateriaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MateriaAlumno
     */
    omit?: MateriaAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model AgendaAlumno
   */

  export type AggregateAgendaAlumno = {
    _count: AgendaAlumnoCountAggregateOutputType | null
    _min: AgendaAlumnoMinAggregateOutputType | null
    _max: AgendaAlumnoMaxAggregateOutputType | null
  }

  export type AgendaAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    agendaId: string | null
    titulo: string | null
    descripcion: string | null
    fecha: Date | null
    tipo: string | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AgendaAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    agendaId: string | null
    titulo: string | null
    descripcion: string | null
    fecha: Date | null
    tipo: string | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AgendaAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    alumnoId: number
    agendaId: number
    titulo: number
    descripcion: number
    fecha: number
    tipo: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AgendaAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    agendaId?: true
    titulo?: true
    descripcion?: true
    fecha?: true
    tipo?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AgendaAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    agendaId?: true
    titulo?: true
    descripcion?: true
    fecha?: true
    tipo?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AgendaAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    agendaId?: true
    titulo?: true
    descripcion?: true
    fecha?: true
    tipo?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AgendaAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AgendaAlumno to aggregate.
     */
    where?: AgendaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgendaAlumnos to fetch.
     */
    orderBy?: AgendaAlumnoOrderByWithRelationInput | AgendaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AgendaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgendaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgendaAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AgendaAlumnos
    **/
    _count?: true | AgendaAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AgendaAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AgendaAlumnoMaxAggregateInputType
  }

  export type GetAgendaAlumnoAggregateType<T extends AgendaAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregateAgendaAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAgendaAlumno[P]>
      : GetScalarType<T[P], AggregateAgendaAlumno[P]>
  }




  export type AgendaAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AgendaAlumnoWhereInput
    orderBy?: AgendaAlumnoOrderByWithAggregationInput | AgendaAlumnoOrderByWithAggregationInput[]
    by: AgendaAlumnoScalarFieldEnum[] | AgendaAlumnoScalarFieldEnum
    having?: AgendaAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AgendaAlumnoCountAggregateInputType | true
    _min?: AgendaAlumnoMinAggregateInputType
    _max?: AgendaAlumnoMaxAggregateInputType
  }

  export type AgendaAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    alumnoId: string
    agendaId: string
    titulo: string
    descripcion: string | null
    fecha: Date
    tipo: string
    metadata: string | null
    createdAt: Date
    updatedAt: Date
    _count: AgendaAlumnoCountAggregateOutputType | null
    _min: AgendaAlumnoMinAggregateOutputType | null
    _max: AgendaAlumnoMaxAggregateOutputType | null
  }

  type GetAgendaAlumnoGroupByPayload<T extends AgendaAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AgendaAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AgendaAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AgendaAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], AgendaAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type AgendaAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    agendaId?: boolean
    titulo?: boolean
    descripcion?: boolean
    fecha?: boolean
    tipo?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["agendaAlumno"]>

  export type AgendaAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    agendaId?: boolean
    titulo?: boolean
    descripcion?: boolean
    fecha?: boolean
    tipo?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["agendaAlumno"]>

  export type AgendaAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    agendaId?: boolean
    titulo?: boolean
    descripcion?: boolean
    fecha?: boolean
    tipo?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["agendaAlumno"]>

  export type AgendaAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    agendaId?: boolean
    titulo?: boolean
    descripcion?: boolean
    fecha?: boolean
    tipo?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AgendaAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "alumnoId" | "agendaId" | "titulo" | "descripcion" | "fecha" | "tipo" | "metadata" | "createdAt" | "updatedAt", ExtArgs["result"]["agendaAlumno"]>

  export type $AgendaAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AgendaAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      alumnoId: string
      agendaId: string
      titulo: string
      descripcion: string | null
      fecha: Date
      tipo: string
      metadata: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["agendaAlumno"]>
    composites: {}
  }

  type AgendaAlumnoGetPayload<S extends boolean | null | undefined | AgendaAlumnoDefaultArgs> = $Result.GetResult<Prisma.$AgendaAlumnoPayload, S>

  type AgendaAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AgendaAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AgendaAlumnoCountAggregateInputType | true
    }

  export interface AgendaAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AgendaAlumno'], meta: { name: 'AgendaAlumno' } }
    /**
     * Find zero or one AgendaAlumno that matches the filter.
     * @param {AgendaAlumnoFindUniqueArgs} args - Arguments to find a AgendaAlumno
     * @example
     * // Get one AgendaAlumno
     * const agendaAlumno = await prisma.agendaAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AgendaAlumnoFindUniqueArgs>(args: SelectSubset<T, AgendaAlumnoFindUniqueArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AgendaAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AgendaAlumnoFindUniqueOrThrowArgs} args - Arguments to find a AgendaAlumno
     * @example
     * // Get one AgendaAlumno
     * const agendaAlumno = await prisma.agendaAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AgendaAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, AgendaAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AgendaAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgendaAlumnoFindFirstArgs} args - Arguments to find a AgendaAlumno
     * @example
     * // Get one AgendaAlumno
     * const agendaAlumno = await prisma.agendaAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AgendaAlumnoFindFirstArgs>(args?: SelectSubset<T, AgendaAlumnoFindFirstArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AgendaAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgendaAlumnoFindFirstOrThrowArgs} args - Arguments to find a AgendaAlumno
     * @example
     * // Get one AgendaAlumno
     * const agendaAlumno = await prisma.agendaAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AgendaAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, AgendaAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AgendaAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgendaAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AgendaAlumnos
     * const agendaAlumnos = await prisma.agendaAlumno.findMany()
     * 
     * // Get first 10 AgendaAlumnos
     * const agendaAlumnos = await prisma.agendaAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const agendaAlumnoWithIdOnly = await prisma.agendaAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AgendaAlumnoFindManyArgs>(args?: SelectSubset<T, AgendaAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AgendaAlumno.
     * @param {AgendaAlumnoCreateArgs} args - Arguments to create a AgendaAlumno.
     * @example
     * // Create one AgendaAlumno
     * const AgendaAlumno = await prisma.agendaAlumno.create({
     *   data: {
     *     // ... data to create a AgendaAlumno
     *   }
     * })
     * 
     */
    create<T extends AgendaAlumnoCreateArgs>(args: SelectSubset<T, AgendaAlumnoCreateArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AgendaAlumnos.
     * @param {AgendaAlumnoCreateManyArgs} args - Arguments to create many AgendaAlumnos.
     * @example
     * // Create many AgendaAlumnos
     * const agendaAlumno = await prisma.agendaAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AgendaAlumnoCreateManyArgs>(args?: SelectSubset<T, AgendaAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AgendaAlumnos and returns the data saved in the database.
     * @param {AgendaAlumnoCreateManyAndReturnArgs} args - Arguments to create many AgendaAlumnos.
     * @example
     * // Create many AgendaAlumnos
     * const agendaAlumno = await prisma.agendaAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AgendaAlumnos and only return the `id`
     * const agendaAlumnoWithIdOnly = await prisma.agendaAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AgendaAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, AgendaAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AgendaAlumno.
     * @param {AgendaAlumnoDeleteArgs} args - Arguments to delete one AgendaAlumno.
     * @example
     * // Delete one AgendaAlumno
     * const AgendaAlumno = await prisma.agendaAlumno.delete({
     *   where: {
     *     // ... filter to delete one AgendaAlumno
     *   }
     * })
     * 
     */
    delete<T extends AgendaAlumnoDeleteArgs>(args: SelectSubset<T, AgendaAlumnoDeleteArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AgendaAlumno.
     * @param {AgendaAlumnoUpdateArgs} args - Arguments to update one AgendaAlumno.
     * @example
     * // Update one AgendaAlumno
     * const agendaAlumno = await prisma.agendaAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AgendaAlumnoUpdateArgs>(args: SelectSubset<T, AgendaAlumnoUpdateArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AgendaAlumnos.
     * @param {AgendaAlumnoDeleteManyArgs} args - Arguments to filter AgendaAlumnos to delete.
     * @example
     * // Delete a few AgendaAlumnos
     * const { count } = await prisma.agendaAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AgendaAlumnoDeleteManyArgs>(args?: SelectSubset<T, AgendaAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AgendaAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgendaAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AgendaAlumnos
     * const agendaAlumno = await prisma.agendaAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AgendaAlumnoUpdateManyArgs>(args: SelectSubset<T, AgendaAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AgendaAlumnos and returns the data updated in the database.
     * @param {AgendaAlumnoUpdateManyAndReturnArgs} args - Arguments to update many AgendaAlumnos.
     * @example
     * // Update many AgendaAlumnos
     * const agendaAlumno = await prisma.agendaAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AgendaAlumnos and only return the `id`
     * const agendaAlumnoWithIdOnly = await prisma.agendaAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AgendaAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, AgendaAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AgendaAlumno.
     * @param {AgendaAlumnoUpsertArgs} args - Arguments to update or create a AgendaAlumno.
     * @example
     * // Update or create a AgendaAlumno
     * const agendaAlumno = await prisma.agendaAlumno.upsert({
     *   create: {
     *     // ... data to create a AgendaAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AgendaAlumno we want to update
     *   }
     * })
     */
    upsert<T extends AgendaAlumnoUpsertArgs>(args: SelectSubset<T, AgendaAlumnoUpsertArgs<ExtArgs>>): Prisma__AgendaAlumnoClient<$Result.GetResult<Prisma.$AgendaAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AgendaAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgendaAlumnoCountArgs} args - Arguments to filter AgendaAlumnos to count.
     * @example
     * // Count the number of AgendaAlumnos
     * const count = await prisma.agendaAlumno.count({
     *   where: {
     *     // ... the filter for the AgendaAlumnos we want to count
     *   }
     * })
    **/
    count<T extends AgendaAlumnoCountArgs>(
      args?: Subset<T, AgendaAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AgendaAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AgendaAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgendaAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AgendaAlumnoAggregateArgs>(args: Subset<T, AgendaAlumnoAggregateArgs>): Prisma.PrismaPromise<GetAgendaAlumnoAggregateType<T>>

    /**
     * Group by AgendaAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgendaAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AgendaAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AgendaAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: AgendaAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AgendaAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAgendaAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AgendaAlumno model
   */
  readonly fields: AgendaAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AgendaAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AgendaAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AgendaAlumno model
   */
  interface AgendaAlumnoFieldRefs {
    readonly id: FieldRef<"AgendaAlumno", 'String'>
    readonly periodoId: FieldRef<"AgendaAlumno", 'String'>
    readonly alumnoId: FieldRef<"AgendaAlumno", 'String'>
    readonly agendaId: FieldRef<"AgendaAlumno", 'String'>
    readonly titulo: FieldRef<"AgendaAlumno", 'String'>
    readonly descripcion: FieldRef<"AgendaAlumno", 'String'>
    readonly fecha: FieldRef<"AgendaAlumno", 'DateTime'>
    readonly tipo: FieldRef<"AgendaAlumno", 'String'>
    readonly metadata: FieldRef<"AgendaAlumno", 'String'>
    readonly createdAt: FieldRef<"AgendaAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"AgendaAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AgendaAlumno findUnique
   */
  export type AgendaAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AgendaAlumno to fetch.
     */
    where: AgendaAlumnoWhereUniqueInput
  }

  /**
   * AgendaAlumno findUniqueOrThrow
   */
  export type AgendaAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AgendaAlumno to fetch.
     */
    where: AgendaAlumnoWhereUniqueInput
  }

  /**
   * AgendaAlumno findFirst
   */
  export type AgendaAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AgendaAlumno to fetch.
     */
    where?: AgendaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgendaAlumnos to fetch.
     */
    orderBy?: AgendaAlumnoOrderByWithRelationInput | AgendaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AgendaAlumnos.
     */
    cursor?: AgendaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgendaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgendaAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AgendaAlumnos.
     */
    distinct?: AgendaAlumnoScalarFieldEnum | AgendaAlumnoScalarFieldEnum[]
  }

  /**
   * AgendaAlumno findFirstOrThrow
   */
  export type AgendaAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AgendaAlumno to fetch.
     */
    where?: AgendaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgendaAlumnos to fetch.
     */
    orderBy?: AgendaAlumnoOrderByWithRelationInput | AgendaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AgendaAlumnos.
     */
    cursor?: AgendaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgendaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgendaAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AgendaAlumnos.
     */
    distinct?: AgendaAlumnoScalarFieldEnum | AgendaAlumnoScalarFieldEnum[]
  }

  /**
   * AgendaAlumno findMany
   */
  export type AgendaAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AgendaAlumnos to fetch.
     */
    where?: AgendaAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgendaAlumnos to fetch.
     */
    orderBy?: AgendaAlumnoOrderByWithRelationInput | AgendaAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AgendaAlumnos.
     */
    cursor?: AgendaAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgendaAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgendaAlumnos.
     */
    skip?: number
    distinct?: AgendaAlumnoScalarFieldEnum | AgendaAlumnoScalarFieldEnum[]
  }

  /**
   * AgendaAlumno create
   */
  export type AgendaAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a AgendaAlumno.
     */
    data: XOR<AgendaAlumnoCreateInput, AgendaAlumnoUncheckedCreateInput>
  }

  /**
   * AgendaAlumno createMany
   */
  export type AgendaAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AgendaAlumnos.
     */
    data: AgendaAlumnoCreateManyInput | AgendaAlumnoCreateManyInput[]
  }

  /**
   * AgendaAlumno createManyAndReturn
   */
  export type AgendaAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many AgendaAlumnos.
     */
    data: AgendaAlumnoCreateManyInput | AgendaAlumnoCreateManyInput[]
  }

  /**
   * AgendaAlumno update
   */
  export type AgendaAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a AgendaAlumno.
     */
    data: XOR<AgendaAlumnoUpdateInput, AgendaAlumnoUncheckedUpdateInput>
    /**
     * Choose, which AgendaAlumno to update.
     */
    where: AgendaAlumnoWhereUniqueInput
  }

  /**
   * AgendaAlumno updateMany
   */
  export type AgendaAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AgendaAlumnos.
     */
    data: XOR<AgendaAlumnoUpdateManyMutationInput, AgendaAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which AgendaAlumnos to update
     */
    where?: AgendaAlumnoWhereInput
    /**
     * Limit how many AgendaAlumnos to update.
     */
    limit?: number
  }

  /**
   * AgendaAlumno updateManyAndReturn
   */
  export type AgendaAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update AgendaAlumnos.
     */
    data: XOR<AgendaAlumnoUpdateManyMutationInput, AgendaAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which AgendaAlumnos to update
     */
    where?: AgendaAlumnoWhereInput
    /**
     * Limit how many AgendaAlumnos to update.
     */
    limit?: number
  }

  /**
   * AgendaAlumno upsert
   */
  export type AgendaAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the AgendaAlumno to update in case it exists.
     */
    where: AgendaAlumnoWhereUniqueInput
    /**
     * In case the AgendaAlumno found by the `where` argument doesn't exist, create a new AgendaAlumno with this data.
     */
    create: XOR<AgendaAlumnoCreateInput, AgendaAlumnoUncheckedCreateInput>
    /**
     * In case the AgendaAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AgendaAlumnoUpdateInput, AgendaAlumnoUncheckedUpdateInput>
  }

  /**
   * AgendaAlumno delete
   */
  export type AgendaAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
    /**
     * Filter which AgendaAlumno to delete.
     */
    where: AgendaAlumnoWhereUniqueInput
  }

  /**
   * AgendaAlumno deleteMany
   */
  export type AgendaAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AgendaAlumnos to delete
     */
    where?: AgendaAlumnoWhereInput
    /**
     * Limit how many AgendaAlumnos to delete.
     */
    limit?: number
  }

  /**
   * AgendaAlumno without action
   */
  export type AgendaAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgendaAlumno
     */
    select?: AgendaAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AgendaAlumno
     */
    omit?: AgendaAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model AvisoAlumno
   */

  export type AggregateAvisoAlumno = {
    _count: AvisoAlumnoCountAggregateOutputType | null
    _min: AvisoAlumnoMinAggregateOutputType | null
    _max: AvisoAlumnoMaxAggregateOutputType | null
  }

  export type AvisoAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    avisoId: string | null
    titulo: string | null
    mensaje: string | null
    severidad: string | null
    publicadoEn: Date | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AvisoAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    avisoId: string | null
    titulo: string | null
    mensaje: string | null
    severidad: string | null
    publicadoEn: Date | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AvisoAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    alumnoId: number
    avisoId: number
    titulo: number
    mensaje: number
    severidad: number
    publicadoEn: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AvisoAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    avisoId?: true
    titulo?: true
    mensaje?: true
    severidad?: true
    publicadoEn?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AvisoAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    avisoId?: true
    titulo?: true
    mensaje?: true
    severidad?: true
    publicadoEn?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AvisoAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    avisoId?: true
    titulo?: true
    mensaje?: true
    severidad?: true
    publicadoEn?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AvisoAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AvisoAlumno to aggregate.
     */
    where?: AvisoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AvisoAlumnos to fetch.
     */
    orderBy?: AvisoAlumnoOrderByWithRelationInput | AvisoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AvisoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AvisoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AvisoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AvisoAlumnos
    **/
    _count?: true | AvisoAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AvisoAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AvisoAlumnoMaxAggregateInputType
  }

  export type GetAvisoAlumnoAggregateType<T extends AvisoAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregateAvisoAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAvisoAlumno[P]>
      : GetScalarType<T[P], AggregateAvisoAlumno[P]>
  }




  export type AvisoAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AvisoAlumnoWhereInput
    orderBy?: AvisoAlumnoOrderByWithAggregationInput | AvisoAlumnoOrderByWithAggregationInput[]
    by: AvisoAlumnoScalarFieldEnum[] | AvisoAlumnoScalarFieldEnum
    having?: AvisoAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AvisoAlumnoCountAggregateInputType | true
    _min?: AvisoAlumnoMinAggregateInputType
    _max?: AvisoAlumnoMaxAggregateInputType
  }

  export type AvisoAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    alumnoId: string
    avisoId: string
    titulo: string
    mensaje: string
    severidad: string
    publicadoEn: Date
    metadata: string | null
    createdAt: Date
    updatedAt: Date
    _count: AvisoAlumnoCountAggregateOutputType | null
    _min: AvisoAlumnoMinAggregateOutputType | null
    _max: AvisoAlumnoMaxAggregateOutputType | null
  }

  type GetAvisoAlumnoGroupByPayload<T extends AvisoAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AvisoAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AvisoAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AvisoAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], AvisoAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type AvisoAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    avisoId?: boolean
    titulo?: boolean
    mensaje?: boolean
    severidad?: boolean
    publicadoEn?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["avisoAlumno"]>

  export type AvisoAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    avisoId?: boolean
    titulo?: boolean
    mensaje?: boolean
    severidad?: boolean
    publicadoEn?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["avisoAlumno"]>

  export type AvisoAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    avisoId?: boolean
    titulo?: boolean
    mensaje?: boolean
    severidad?: boolean
    publicadoEn?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["avisoAlumno"]>

  export type AvisoAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    avisoId?: boolean
    titulo?: boolean
    mensaje?: boolean
    severidad?: boolean
    publicadoEn?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AvisoAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "alumnoId" | "avisoId" | "titulo" | "mensaje" | "severidad" | "publicadoEn" | "metadata" | "createdAt" | "updatedAt", ExtArgs["result"]["avisoAlumno"]>

  export type $AvisoAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AvisoAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      alumnoId: string
      avisoId: string
      titulo: string
      mensaje: string
      severidad: string
      publicadoEn: Date
      metadata: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["avisoAlumno"]>
    composites: {}
  }

  type AvisoAlumnoGetPayload<S extends boolean | null | undefined | AvisoAlumnoDefaultArgs> = $Result.GetResult<Prisma.$AvisoAlumnoPayload, S>

  type AvisoAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AvisoAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AvisoAlumnoCountAggregateInputType | true
    }

  export interface AvisoAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AvisoAlumno'], meta: { name: 'AvisoAlumno' } }
    /**
     * Find zero or one AvisoAlumno that matches the filter.
     * @param {AvisoAlumnoFindUniqueArgs} args - Arguments to find a AvisoAlumno
     * @example
     * // Get one AvisoAlumno
     * const avisoAlumno = await prisma.avisoAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AvisoAlumnoFindUniqueArgs>(args: SelectSubset<T, AvisoAlumnoFindUniqueArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AvisoAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AvisoAlumnoFindUniqueOrThrowArgs} args - Arguments to find a AvisoAlumno
     * @example
     * // Get one AvisoAlumno
     * const avisoAlumno = await prisma.avisoAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AvisoAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, AvisoAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AvisoAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AvisoAlumnoFindFirstArgs} args - Arguments to find a AvisoAlumno
     * @example
     * // Get one AvisoAlumno
     * const avisoAlumno = await prisma.avisoAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AvisoAlumnoFindFirstArgs>(args?: SelectSubset<T, AvisoAlumnoFindFirstArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AvisoAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AvisoAlumnoFindFirstOrThrowArgs} args - Arguments to find a AvisoAlumno
     * @example
     * // Get one AvisoAlumno
     * const avisoAlumno = await prisma.avisoAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AvisoAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, AvisoAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AvisoAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AvisoAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AvisoAlumnos
     * const avisoAlumnos = await prisma.avisoAlumno.findMany()
     * 
     * // Get first 10 AvisoAlumnos
     * const avisoAlumnos = await prisma.avisoAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const avisoAlumnoWithIdOnly = await prisma.avisoAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AvisoAlumnoFindManyArgs>(args?: SelectSubset<T, AvisoAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AvisoAlumno.
     * @param {AvisoAlumnoCreateArgs} args - Arguments to create a AvisoAlumno.
     * @example
     * // Create one AvisoAlumno
     * const AvisoAlumno = await prisma.avisoAlumno.create({
     *   data: {
     *     // ... data to create a AvisoAlumno
     *   }
     * })
     * 
     */
    create<T extends AvisoAlumnoCreateArgs>(args: SelectSubset<T, AvisoAlumnoCreateArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AvisoAlumnos.
     * @param {AvisoAlumnoCreateManyArgs} args - Arguments to create many AvisoAlumnos.
     * @example
     * // Create many AvisoAlumnos
     * const avisoAlumno = await prisma.avisoAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AvisoAlumnoCreateManyArgs>(args?: SelectSubset<T, AvisoAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AvisoAlumnos and returns the data saved in the database.
     * @param {AvisoAlumnoCreateManyAndReturnArgs} args - Arguments to create many AvisoAlumnos.
     * @example
     * // Create many AvisoAlumnos
     * const avisoAlumno = await prisma.avisoAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AvisoAlumnos and only return the `id`
     * const avisoAlumnoWithIdOnly = await prisma.avisoAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AvisoAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, AvisoAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AvisoAlumno.
     * @param {AvisoAlumnoDeleteArgs} args - Arguments to delete one AvisoAlumno.
     * @example
     * // Delete one AvisoAlumno
     * const AvisoAlumno = await prisma.avisoAlumno.delete({
     *   where: {
     *     // ... filter to delete one AvisoAlumno
     *   }
     * })
     * 
     */
    delete<T extends AvisoAlumnoDeleteArgs>(args: SelectSubset<T, AvisoAlumnoDeleteArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AvisoAlumno.
     * @param {AvisoAlumnoUpdateArgs} args - Arguments to update one AvisoAlumno.
     * @example
     * // Update one AvisoAlumno
     * const avisoAlumno = await prisma.avisoAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AvisoAlumnoUpdateArgs>(args: SelectSubset<T, AvisoAlumnoUpdateArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AvisoAlumnos.
     * @param {AvisoAlumnoDeleteManyArgs} args - Arguments to filter AvisoAlumnos to delete.
     * @example
     * // Delete a few AvisoAlumnos
     * const { count } = await prisma.avisoAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AvisoAlumnoDeleteManyArgs>(args?: SelectSubset<T, AvisoAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AvisoAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AvisoAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AvisoAlumnos
     * const avisoAlumno = await prisma.avisoAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AvisoAlumnoUpdateManyArgs>(args: SelectSubset<T, AvisoAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AvisoAlumnos and returns the data updated in the database.
     * @param {AvisoAlumnoUpdateManyAndReturnArgs} args - Arguments to update many AvisoAlumnos.
     * @example
     * // Update many AvisoAlumnos
     * const avisoAlumno = await prisma.avisoAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AvisoAlumnos and only return the `id`
     * const avisoAlumnoWithIdOnly = await prisma.avisoAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AvisoAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, AvisoAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AvisoAlumno.
     * @param {AvisoAlumnoUpsertArgs} args - Arguments to update or create a AvisoAlumno.
     * @example
     * // Update or create a AvisoAlumno
     * const avisoAlumno = await prisma.avisoAlumno.upsert({
     *   create: {
     *     // ... data to create a AvisoAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AvisoAlumno we want to update
     *   }
     * })
     */
    upsert<T extends AvisoAlumnoUpsertArgs>(args: SelectSubset<T, AvisoAlumnoUpsertArgs<ExtArgs>>): Prisma__AvisoAlumnoClient<$Result.GetResult<Prisma.$AvisoAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AvisoAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AvisoAlumnoCountArgs} args - Arguments to filter AvisoAlumnos to count.
     * @example
     * // Count the number of AvisoAlumnos
     * const count = await prisma.avisoAlumno.count({
     *   where: {
     *     // ... the filter for the AvisoAlumnos we want to count
     *   }
     * })
    **/
    count<T extends AvisoAlumnoCountArgs>(
      args?: Subset<T, AvisoAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AvisoAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AvisoAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AvisoAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AvisoAlumnoAggregateArgs>(args: Subset<T, AvisoAlumnoAggregateArgs>): Prisma.PrismaPromise<GetAvisoAlumnoAggregateType<T>>

    /**
     * Group by AvisoAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AvisoAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AvisoAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AvisoAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: AvisoAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AvisoAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAvisoAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AvisoAlumno model
   */
  readonly fields: AvisoAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AvisoAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AvisoAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AvisoAlumno model
   */
  interface AvisoAlumnoFieldRefs {
    readonly id: FieldRef<"AvisoAlumno", 'String'>
    readonly periodoId: FieldRef<"AvisoAlumno", 'String'>
    readonly alumnoId: FieldRef<"AvisoAlumno", 'String'>
    readonly avisoId: FieldRef<"AvisoAlumno", 'String'>
    readonly titulo: FieldRef<"AvisoAlumno", 'String'>
    readonly mensaje: FieldRef<"AvisoAlumno", 'String'>
    readonly severidad: FieldRef<"AvisoAlumno", 'String'>
    readonly publicadoEn: FieldRef<"AvisoAlumno", 'DateTime'>
    readonly metadata: FieldRef<"AvisoAlumno", 'String'>
    readonly createdAt: FieldRef<"AvisoAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"AvisoAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AvisoAlumno findUnique
   */
  export type AvisoAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AvisoAlumno to fetch.
     */
    where: AvisoAlumnoWhereUniqueInput
  }

  /**
   * AvisoAlumno findUniqueOrThrow
   */
  export type AvisoAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AvisoAlumno to fetch.
     */
    where: AvisoAlumnoWhereUniqueInput
  }

  /**
   * AvisoAlumno findFirst
   */
  export type AvisoAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AvisoAlumno to fetch.
     */
    where?: AvisoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AvisoAlumnos to fetch.
     */
    orderBy?: AvisoAlumnoOrderByWithRelationInput | AvisoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AvisoAlumnos.
     */
    cursor?: AvisoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AvisoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AvisoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AvisoAlumnos.
     */
    distinct?: AvisoAlumnoScalarFieldEnum | AvisoAlumnoScalarFieldEnum[]
  }

  /**
   * AvisoAlumno findFirstOrThrow
   */
  export type AvisoAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AvisoAlumno to fetch.
     */
    where?: AvisoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AvisoAlumnos to fetch.
     */
    orderBy?: AvisoAlumnoOrderByWithRelationInput | AvisoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AvisoAlumnos.
     */
    cursor?: AvisoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AvisoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AvisoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AvisoAlumnos.
     */
    distinct?: AvisoAlumnoScalarFieldEnum | AvisoAlumnoScalarFieldEnum[]
  }

  /**
   * AvisoAlumno findMany
   */
  export type AvisoAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which AvisoAlumnos to fetch.
     */
    where?: AvisoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AvisoAlumnos to fetch.
     */
    orderBy?: AvisoAlumnoOrderByWithRelationInput | AvisoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AvisoAlumnos.
     */
    cursor?: AvisoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AvisoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AvisoAlumnos.
     */
    skip?: number
    distinct?: AvisoAlumnoScalarFieldEnum | AvisoAlumnoScalarFieldEnum[]
  }

  /**
   * AvisoAlumno create
   */
  export type AvisoAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a AvisoAlumno.
     */
    data: XOR<AvisoAlumnoCreateInput, AvisoAlumnoUncheckedCreateInput>
  }

  /**
   * AvisoAlumno createMany
   */
  export type AvisoAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AvisoAlumnos.
     */
    data: AvisoAlumnoCreateManyInput | AvisoAlumnoCreateManyInput[]
  }

  /**
   * AvisoAlumno createManyAndReturn
   */
  export type AvisoAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many AvisoAlumnos.
     */
    data: AvisoAlumnoCreateManyInput | AvisoAlumnoCreateManyInput[]
  }

  /**
   * AvisoAlumno update
   */
  export type AvisoAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a AvisoAlumno.
     */
    data: XOR<AvisoAlumnoUpdateInput, AvisoAlumnoUncheckedUpdateInput>
    /**
     * Choose, which AvisoAlumno to update.
     */
    where: AvisoAlumnoWhereUniqueInput
  }

  /**
   * AvisoAlumno updateMany
   */
  export type AvisoAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AvisoAlumnos.
     */
    data: XOR<AvisoAlumnoUpdateManyMutationInput, AvisoAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which AvisoAlumnos to update
     */
    where?: AvisoAlumnoWhereInput
    /**
     * Limit how many AvisoAlumnos to update.
     */
    limit?: number
  }

  /**
   * AvisoAlumno updateManyAndReturn
   */
  export type AvisoAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update AvisoAlumnos.
     */
    data: XOR<AvisoAlumnoUpdateManyMutationInput, AvisoAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which AvisoAlumnos to update
     */
    where?: AvisoAlumnoWhereInput
    /**
     * Limit how many AvisoAlumnos to update.
     */
    limit?: number
  }

  /**
   * AvisoAlumno upsert
   */
  export type AvisoAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the AvisoAlumno to update in case it exists.
     */
    where: AvisoAlumnoWhereUniqueInput
    /**
     * In case the AvisoAlumno found by the `where` argument doesn't exist, create a new AvisoAlumno with this data.
     */
    create: XOR<AvisoAlumnoCreateInput, AvisoAlumnoUncheckedCreateInput>
    /**
     * In case the AvisoAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AvisoAlumnoUpdateInput, AvisoAlumnoUncheckedUpdateInput>
  }

  /**
   * AvisoAlumno delete
   */
  export type AvisoAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
    /**
     * Filter which AvisoAlumno to delete.
     */
    where: AvisoAlumnoWhereUniqueInput
  }

  /**
   * AvisoAlumno deleteMany
   */
  export type AvisoAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AvisoAlumnos to delete
     */
    where?: AvisoAlumnoWhereInput
    /**
     * Limit how many AvisoAlumnos to delete.
     */
    limit?: number
  }

  /**
   * AvisoAlumno without action
   */
  export type AvisoAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AvisoAlumno
     */
    select?: AvisoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AvisoAlumno
     */
    omit?: AvisoAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model HistorialAlumno
   */

  export type AggregateHistorialAlumno = {
    _count: HistorialAlumnoCountAggregateOutputType | null
    _avg: HistorialAlumnoAvgAggregateOutputType | null
    _sum: HistorialAlumnoSumAggregateOutputType | null
    _min: HistorialAlumnoMinAggregateOutputType | null
    _max: HistorialAlumnoMaxAggregateOutputType | null
  }

  export type HistorialAlumnoAvgAggregateOutputType = {
    aciertos: number | null
    totalReactivos: number | null
  }

  export type HistorialAlumnoSumAggregateOutputType = {
    aciertos: number | null
    totalReactivos: number | null
  }

  export type HistorialAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    historialId: string | null
    folio: string | null
    tipoExamen: string | null
    calificacionTexto: string | null
    aciertos: number | null
    totalReactivos: number | null
    fecha: Date | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type HistorialAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    historialId: string | null
    folio: string | null
    tipoExamen: string | null
    calificacionTexto: string | null
    aciertos: number | null
    totalReactivos: number | null
    fecha: Date | null
    metadata: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type HistorialAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    alumnoId: number
    historialId: number
    folio: number
    tipoExamen: number
    calificacionTexto: number
    aciertos: number
    totalReactivos: number
    fecha: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type HistorialAlumnoAvgAggregateInputType = {
    aciertos?: true
    totalReactivos?: true
  }

  export type HistorialAlumnoSumAggregateInputType = {
    aciertos?: true
    totalReactivos?: true
  }

  export type HistorialAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    historialId?: true
    folio?: true
    tipoExamen?: true
    calificacionTexto?: true
    aciertos?: true
    totalReactivos?: true
    fecha?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type HistorialAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    historialId?: true
    folio?: true
    tipoExamen?: true
    calificacionTexto?: true
    aciertos?: true
    totalReactivos?: true
    fecha?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
  }

  export type HistorialAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    historialId?: true
    folio?: true
    tipoExamen?: true
    calificacionTexto?: true
    aciertos?: true
    totalReactivos?: true
    fecha?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type HistorialAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HistorialAlumno to aggregate.
     */
    where?: HistorialAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HistorialAlumnos to fetch.
     */
    orderBy?: HistorialAlumnoOrderByWithRelationInput | HistorialAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: HistorialAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HistorialAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HistorialAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned HistorialAlumnos
    **/
    _count?: true | HistorialAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: HistorialAlumnoAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: HistorialAlumnoSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: HistorialAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: HistorialAlumnoMaxAggregateInputType
  }

  export type GetHistorialAlumnoAggregateType<T extends HistorialAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregateHistorialAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateHistorialAlumno[P]>
      : GetScalarType<T[P], AggregateHistorialAlumno[P]>
  }




  export type HistorialAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: HistorialAlumnoWhereInput
    orderBy?: HistorialAlumnoOrderByWithAggregationInput | HistorialAlumnoOrderByWithAggregationInput[]
    by: HistorialAlumnoScalarFieldEnum[] | HistorialAlumnoScalarFieldEnum
    having?: HistorialAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: HistorialAlumnoCountAggregateInputType | true
    _avg?: HistorialAlumnoAvgAggregateInputType
    _sum?: HistorialAlumnoSumAggregateInputType
    _min?: HistorialAlumnoMinAggregateInputType
    _max?: HistorialAlumnoMaxAggregateInputType
  }

  export type HistorialAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    alumnoId: string
    historialId: string
    folio: string | null
    tipoExamen: string | null
    calificacionTexto: string | null
    aciertos: number | null
    totalReactivos: number | null
    fecha: Date
    metadata: string | null
    createdAt: Date
    updatedAt: Date
    _count: HistorialAlumnoCountAggregateOutputType | null
    _avg: HistorialAlumnoAvgAggregateOutputType | null
    _sum: HistorialAlumnoSumAggregateOutputType | null
    _min: HistorialAlumnoMinAggregateOutputType | null
    _max: HistorialAlumnoMaxAggregateOutputType | null
  }

  type GetHistorialAlumnoGroupByPayload<T extends HistorialAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<HistorialAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof HistorialAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], HistorialAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], HistorialAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type HistorialAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    historialId?: boolean
    folio?: boolean
    tipoExamen?: boolean
    calificacionTexto?: boolean
    aciertos?: boolean
    totalReactivos?: boolean
    fecha?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["historialAlumno"]>

  export type HistorialAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    historialId?: boolean
    folio?: boolean
    tipoExamen?: boolean
    calificacionTexto?: boolean
    aciertos?: boolean
    totalReactivos?: boolean
    fecha?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["historialAlumno"]>

  export type HistorialAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    historialId?: boolean
    folio?: boolean
    tipoExamen?: boolean
    calificacionTexto?: boolean
    aciertos?: boolean
    totalReactivos?: boolean
    fecha?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["historialAlumno"]>

  export type HistorialAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    historialId?: boolean
    folio?: boolean
    tipoExamen?: boolean
    calificacionTexto?: boolean
    aciertos?: boolean
    totalReactivos?: boolean
    fecha?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type HistorialAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "alumnoId" | "historialId" | "folio" | "tipoExamen" | "calificacionTexto" | "aciertos" | "totalReactivos" | "fecha" | "metadata" | "createdAt" | "updatedAt", ExtArgs["result"]["historialAlumno"]>

  export type $HistorialAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "HistorialAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      alumnoId: string
      historialId: string
      folio: string | null
      tipoExamen: string | null
      calificacionTexto: string | null
      aciertos: number | null
      totalReactivos: number | null
      fecha: Date
      metadata: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["historialAlumno"]>
    composites: {}
  }

  type HistorialAlumnoGetPayload<S extends boolean | null | undefined | HistorialAlumnoDefaultArgs> = $Result.GetResult<Prisma.$HistorialAlumnoPayload, S>

  type HistorialAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<HistorialAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: HistorialAlumnoCountAggregateInputType | true
    }

  export interface HistorialAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['HistorialAlumno'], meta: { name: 'HistorialAlumno' } }
    /**
     * Find zero or one HistorialAlumno that matches the filter.
     * @param {HistorialAlumnoFindUniqueArgs} args - Arguments to find a HistorialAlumno
     * @example
     * // Get one HistorialAlumno
     * const historialAlumno = await prisma.historialAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends HistorialAlumnoFindUniqueArgs>(args: SelectSubset<T, HistorialAlumnoFindUniqueArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one HistorialAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {HistorialAlumnoFindUniqueOrThrowArgs} args - Arguments to find a HistorialAlumno
     * @example
     * // Get one HistorialAlumno
     * const historialAlumno = await prisma.historialAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends HistorialAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, HistorialAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first HistorialAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HistorialAlumnoFindFirstArgs} args - Arguments to find a HistorialAlumno
     * @example
     * // Get one HistorialAlumno
     * const historialAlumno = await prisma.historialAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends HistorialAlumnoFindFirstArgs>(args?: SelectSubset<T, HistorialAlumnoFindFirstArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first HistorialAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HistorialAlumnoFindFirstOrThrowArgs} args - Arguments to find a HistorialAlumno
     * @example
     * // Get one HistorialAlumno
     * const historialAlumno = await prisma.historialAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends HistorialAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, HistorialAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more HistorialAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HistorialAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all HistorialAlumnos
     * const historialAlumnos = await prisma.historialAlumno.findMany()
     * 
     * // Get first 10 HistorialAlumnos
     * const historialAlumnos = await prisma.historialAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const historialAlumnoWithIdOnly = await prisma.historialAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends HistorialAlumnoFindManyArgs>(args?: SelectSubset<T, HistorialAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a HistorialAlumno.
     * @param {HistorialAlumnoCreateArgs} args - Arguments to create a HistorialAlumno.
     * @example
     * // Create one HistorialAlumno
     * const HistorialAlumno = await prisma.historialAlumno.create({
     *   data: {
     *     // ... data to create a HistorialAlumno
     *   }
     * })
     * 
     */
    create<T extends HistorialAlumnoCreateArgs>(args: SelectSubset<T, HistorialAlumnoCreateArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many HistorialAlumnos.
     * @param {HistorialAlumnoCreateManyArgs} args - Arguments to create many HistorialAlumnos.
     * @example
     * // Create many HistorialAlumnos
     * const historialAlumno = await prisma.historialAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends HistorialAlumnoCreateManyArgs>(args?: SelectSubset<T, HistorialAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many HistorialAlumnos and returns the data saved in the database.
     * @param {HistorialAlumnoCreateManyAndReturnArgs} args - Arguments to create many HistorialAlumnos.
     * @example
     * // Create many HistorialAlumnos
     * const historialAlumno = await prisma.historialAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many HistorialAlumnos and only return the `id`
     * const historialAlumnoWithIdOnly = await prisma.historialAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends HistorialAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, HistorialAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a HistorialAlumno.
     * @param {HistorialAlumnoDeleteArgs} args - Arguments to delete one HistorialAlumno.
     * @example
     * // Delete one HistorialAlumno
     * const HistorialAlumno = await prisma.historialAlumno.delete({
     *   where: {
     *     // ... filter to delete one HistorialAlumno
     *   }
     * })
     * 
     */
    delete<T extends HistorialAlumnoDeleteArgs>(args: SelectSubset<T, HistorialAlumnoDeleteArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one HistorialAlumno.
     * @param {HistorialAlumnoUpdateArgs} args - Arguments to update one HistorialAlumno.
     * @example
     * // Update one HistorialAlumno
     * const historialAlumno = await prisma.historialAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends HistorialAlumnoUpdateArgs>(args: SelectSubset<T, HistorialAlumnoUpdateArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more HistorialAlumnos.
     * @param {HistorialAlumnoDeleteManyArgs} args - Arguments to filter HistorialAlumnos to delete.
     * @example
     * // Delete a few HistorialAlumnos
     * const { count } = await prisma.historialAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends HistorialAlumnoDeleteManyArgs>(args?: SelectSubset<T, HistorialAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more HistorialAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HistorialAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many HistorialAlumnos
     * const historialAlumno = await prisma.historialAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends HistorialAlumnoUpdateManyArgs>(args: SelectSubset<T, HistorialAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more HistorialAlumnos and returns the data updated in the database.
     * @param {HistorialAlumnoUpdateManyAndReturnArgs} args - Arguments to update many HistorialAlumnos.
     * @example
     * // Update many HistorialAlumnos
     * const historialAlumno = await prisma.historialAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more HistorialAlumnos and only return the `id`
     * const historialAlumnoWithIdOnly = await prisma.historialAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends HistorialAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, HistorialAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one HistorialAlumno.
     * @param {HistorialAlumnoUpsertArgs} args - Arguments to update or create a HistorialAlumno.
     * @example
     * // Update or create a HistorialAlumno
     * const historialAlumno = await prisma.historialAlumno.upsert({
     *   create: {
     *     // ... data to create a HistorialAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the HistorialAlumno we want to update
     *   }
     * })
     */
    upsert<T extends HistorialAlumnoUpsertArgs>(args: SelectSubset<T, HistorialAlumnoUpsertArgs<ExtArgs>>): Prisma__HistorialAlumnoClient<$Result.GetResult<Prisma.$HistorialAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of HistorialAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HistorialAlumnoCountArgs} args - Arguments to filter HistorialAlumnos to count.
     * @example
     * // Count the number of HistorialAlumnos
     * const count = await prisma.historialAlumno.count({
     *   where: {
     *     // ... the filter for the HistorialAlumnos we want to count
     *   }
     * })
    **/
    count<T extends HistorialAlumnoCountArgs>(
      args?: Subset<T, HistorialAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], HistorialAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a HistorialAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HistorialAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends HistorialAlumnoAggregateArgs>(args: Subset<T, HistorialAlumnoAggregateArgs>): Prisma.PrismaPromise<GetHistorialAlumnoAggregateType<T>>

    /**
     * Group by HistorialAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HistorialAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends HistorialAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: HistorialAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: HistorialAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, HistorialAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHistorialAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the HistorialAlumno model
   */
  readonly fields: HistorialAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for HistorialAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__HistorialAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the HistorialAlumno model
   */
  interface HistorialAlumnoFieldRefs {
    readonly id: FieldRef<"HistorialAlumno", 'String'>
    readonly periodoId: FieldRef<"HistorialAlumno", 'String'>
    readonly alumnoId: FieldRef<"HistorialAlumno", 'String'>
    readonly historialId: FieldRef<"HistorialAlumno", 'String'>
    readonly folio: FieldRef<"HistorialAlumno", 'String'>
    readonly tipoExamen: FieldRef<"HistorialAlumno", 'String'>
    readonly calificacionTexto: FieldRef<"HistorialAlumno", 'String'>
    readonly aciertos: FieldRef<"HistorialAlumno", 'Int'>
    readonly totalReactivos: FieldRef<"HistorialAlumno", 'Int'>
    readonly fecha: FieldRef<"HistorialAlumno", 'DateTime'>
    readonly metadata: FieldRef<"HistorialAlumno", 'String'>
    readonly createdAt: FieldRef<"HistorialAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"HistorialAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * HistorialAlumno findUnique
   */
  export type HistorialAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which HistorialAlumno to fetch.
     */
    where: HistorialAlumnoWhereUniqueInput
  }

  /**
   * HistorialAlumno findUniqueOrThrow
   */
  export type HistorialAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which HistorialAlumno to fetch.
     */
    where: HistorialAlumnoWhereUniqueInput
  }

  /**
   * HistorialAlumno findFirst
   */
  export type HistorialAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which HistorialAlumno to fetch.
     */
    where?: HistorialAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HistorialAlumnos to fetch.
     */
    orderBy?: HistorialAlumnoOrderByWithRelationInput | HistorialAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HistorialAlumnos.
     */
    cursor?: HistorialAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HistorialAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HistorialAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HistorialAlumnos.
     */
    distinct?: HistorialAlumnoScalarFieldEnum | HistorialAlumnoScalarFieldEnum[]
  }

  /**
   * HistorialAlumno findFirstOrThrow
   */
  export type HistorialAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which HistorialAlumno to fetch.
     */
    where?: HistorialAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HistorialAlumnos to fetch.
     */
    orderBy?: HistorialAlumnoOrderByWithRelationInput | HistorialAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HistorialAlumnos.
     */
    cursor?: HistorialAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HistorialAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HistorialAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HistorialAlumnos.
     */
    distinct?: HistorialAlumnoScalarFieldEnum | HistorialAlumnoScalarFieldEnum[]
  }

  /**
   * HistorialAlumno findMany
   */
  export type HistorialAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which HistorialAlumnos to fetch.
     */
    where?: HistorialAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HistorialAlumnos to fetch.
     */
    orderBy?: HistorialAlumnoOrderByWithRelationInput | HistorialAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing HistorialAlumnos.
     */
    cursor?: HistorialAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HistorialAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HistorialAlumnos.
     */
    skip?: number
    distinct?: HistorialAlumnoScalarFieldEnum | HistorialAlumnoScalarFieldEnum[]
  }

  /**
   * HistorialAlumno create
   */
  export type HistorialAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a HistorialAlumno.
     */
    data: XOR<HistorialAlumnoCreateInput, HistorialAlumnoUncheckedCreateInput>
  }

  /**
   * HistorialAlumno createMany
   */
  export type HistorialAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many HistorialAlumnos.
     */
    data: HistorialAlumnoCreateManyInput | HistorialAlumnoCreateManyInput[]
  }

  /**
   * HistorialAlumno createManyAndReturn
   */
  export type HistorialAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many HistorialAlumnos.
     */
    data: HistorialAlumnoCreateManyInput | HistorialAlumnoCreateManyInput[]
  }

  /**
   * HistorialAlumno update
   */
  export type HistorialAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a HistorialAlumno.
     */
    data: XOR<HistorialAlumnoUpdateInput, HistorialAlumnoUncheckedUpdateInput>
    /**
     * Choose, which HistorialAlumno to update.
     */
    where: HistorialAlumnoWhereUniqueInput
  }

  /**
   * HistorialAlumno updateMany
   */
  export type HistorialAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update HistorialAlumnos.
     */
    data: XOR<HistorialAlumnoUpdateManyMutationInput, HistorialAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which HistorialAlumnos to update
     */
    where?: HistorialAlumnoWhereInput
    /**
     * Limit how many HistorialAlumnos to update.
     */
    limit?: number
  }

  /**
   * HistorialAlumno updateManyAndReturn
   */
  export type HistorialAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update HistorialAlumnos.
     */
    data: XOR<HistorialAlumnoUpdateManyMutationInput, HistorialAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which HistorialAlumnos to update
     */
    where?: HistorialAlumnoWhereInput
    /**
     * Limit how many HistorialAlumnos to update.
     */
    limit?: number
  }

  /**
   * HistorialAlumno upsert
   */
  export type HistorialAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the HistorialAlumno to update in case it exists.
     */
    where: HistorialAlumnoWhereUniqueInput
    /**
     * In case the HistorialAlumno found by the `where` argument doesn't exist, create a new HistorialAlumno with this data.
     */
    create: XOR<HistorialAlumnoCreateInput, HistorialAlumnoUncheckedCreateInput>
    /**
     * In case the HistorialAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<HistorialAlumnoUpdateInput, HistorialAlumnoUncheckedUpdateInput>
  }

  /**
   * HistorialAlumno delete
   */
  export type HistorialAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
    /**
     * Filter which HistorialAlumno to delete.
     */
    where: HistorialAlumnoWhereUniqueInput
  }

  /**
   * HistorialAlumno deleteMany
   */
  export type HistorialAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HistorialAlumnos to delete
     */
    where?: HistorialAlumnoWhereInput
    /**
     * Limit how many HistorialAlumnos to delete.
     */
    limit?: number
  }

  /**
   * HistorialAlumno without action
   */
  export type HistorialAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HistorialAlumno
     */
    select?: HistorialAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HistorialAlumno
     */
    omit?: HistorialAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model CodigoAcceso
   */

  export type AggregateCodigoAcceso = {
    _count: CodigoAccesoCountAggregateOutputType | null
    _min: CodigoAccesoMinAggregateOutputType | null
    _max: CodigoAccesoMaxAggregateOutputType | null
  }

  export type CodigoAccesoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    codigo: string | null
    expiraEn: Date | null
    usado: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CodigoAccesoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    codigo: string | null
    expiraEn: Date | null
    usado: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CodigoAccesoCountAggregateOutputType = {
    id: number
    periodoId: number
    codigo: number
    expiraEn: number
    usado: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CodigoAccesoMinAggregateInputType = {
    id?: true
    periodoId?: true
    codigo?: true
    expiraEn?: true
    usado?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CodigoAccesoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    codigo?: true
    expiraEn?: true
    usado?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CodigoAccesoCountAggregateInputType = {
    id?: true
    periodoId?: true
    codigo?: true
    expiraEn?: true
    usado?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CodigoAccesoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CodigoAcceso to aggregate.
     */
    where?: CodigoAccesoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CodigoAccesos to fetch.
     */
    orderBy?: CodigoAccesoOrderByWithRelationInput | CodigoAccesoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CodigoAccesoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CodigoAccesos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CodigoAccesos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CodigoAccesos
    **/
    _count?: true | CodigoAccesoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CodigoAccesoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CodigoAccesoMaxAggregateInputType
  }

  export type GetCodigoAccesoAggregateType<T extends CodigoAccesoAggregateArgs> = {
        [P in keyof T & keyof AggregateCodigoAcceso]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCodigoAcceso[P]>
      : GetScalarType<T[P], AggregateCodigoAcceso[P]>
  }




  export type CodigoAccesoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CodigoAccesoWhereInput
    orderBy?: CodigoAccesoOrderByWithAggregationInput | CodigoAccesoOrderByWithAggregationInput[]
    by: CodigoAccesoScalarFieldEnum[] | CodigoAccesoScalarFieldEnum
    having?: CodigoAccesoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CodigoAccesoCountAggregateInputType | true
    _min?: CodigoAccesoMinAggregateInputType
    _max?: CodigoAccesoMaxAggregateInputType
  }

  export type CodigoAccesoGroupByOutputType = {
    id: string
    periodoId: string
    codigo: string
    expiraEn: Date
    usado: boolean
    createdAt: Date
    updatedAt: Date
    _count: CodigoAccesoCountAggregateOutputType | null
    _min: CodigoAccesoMinAggregateOutputType | null
    _max: CodigoAccesoMaxAggregateOutputType | null
  }

  type GetCodigoAccesoGroupByPayload<T extends CodigoAccesoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CodigoAccesoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CodigoAccesoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CodigoAccesoGroupByOutputType[P]>
            : GetScalarType<T[P], CodigoAccesoGroupByOutputType[P]>
        }
      >
    >


  export type CodigoAccesoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    codigo?: boolean
    expiraEn?: boolean
    usado?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["codigoAcceso"]>

  export type CodigoAccesoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    codigo?: boolean
    expiraEn?: boolean
    usado?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["codigoAcceso"]>

  export type CodigoAccesoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    codigo?: boolean
    expiraEn?: boolean
    usado?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["codigoAcceso"]>

  export type CodigoAccesoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    codigo?: boolean
    expiraEn?: boolean
    usado?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CodigoAccesoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "codigo" | "expiraEn" | "usado" | "createdAt" | "updatedAt", ExtArgs["result"]["codigoAcceso"]>

  export type $CodigoAccesoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CodigoAcceso"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      codigo: string
      expiraEn: Date
      usado: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["codigoAcceso"]>
    composites: {}
  }

  type CodigoAccesoGetPayload<S extends boolean | null | undefined | CodigoAccesoDefaultArgs> = $Result.GetResult<Prisma.$CodigoAccesoPayload, S>

  type CodigoAccesoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CodigoAccesoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CodigoAccesoCountAggregateInputType | true
    }

  export interface CodigoAccesoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CodigoAcceso'], meta: { name: 'CodigoAcceso' } }
    /**
     * Find zero or one CodigoAcceso that matches the filter.
     * @param {CodigoAccesoFindUniqueArgs} args - Arguments to find a CodigoAcceso
     * @example
     * // Get one CodigoAcceso
     * const codigoAcceso = await prisma.codigoAcceso.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CodigoAccesoFindUniqueArgs>(args: SelectSubset<T, CodigoAccesoFindUniqueArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CodigoAcceso that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CodigoAccesoFindUniqueOrThrowArgs} args - Arguments to find a CodigoAcceso
     * @example
     * // Get one CodigoAcceso
     * const codigoAcceso = await prisma.codigoAcceso.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CodigoAccesoFindUniqueOrThrowArgs>(args: SelectSubset<T, CodigoAccesoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CodigoAcceso that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CodigoAccesoFindFirstArgs} args - Arguments to find a CodigoAcceso
     * @example
     * // Get one CodigoAcceso
     * const codigoAcceso = await prisma.codigoAcceso.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CodigoAccesoFindFirstArgs>(args?: SelectSubset<T, CodigoAccesoFindFirstArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CodigoAcceso that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CodigoAccesoFindFirstOrThrowArgs} args - Arguments to find a CodigoAcceso
     * @example
     * // Get one CodigoAcceso
     * const codigoAcceso = await prisma.codigoAcceso.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CodigoAccesoFindFirstOrThrowArgs>(args?: SelectSubset<T, CodigoAccesoFindFirstOrThrowArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CodigoAccesos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CodigoAccesoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CodigoAccesos
     * const codigoAccesos = await prisma.codigoAcceso.findMany()
     * 
     * // Get first 10 CodigoAccesos
     * const codigoAccesos = await prisma.codigoAcceso.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const codigoAccesoWithIdOnly = await prisma.codigoAcceso.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CodigoAccesoFindManyArgs>(args?: SelectSubset<T, CodigoAccesoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CodigoAcceso.
     * @param {CodigoAccesoCreateArgs} args - Arguments to create a CodigoAcceso.
     * @example
     * // Create one CodigoAcceso
     * const CodigoAcceso = await prisma.codigoAcceso.create({
     *   data: {
     *     // ... data to create a CodigoAcceso
     *   }
     * })
     * 
     */
    create<T extends CodigoAccesoCreateArgs>(args: SelectSubset<T, CodigoAccesoCreateArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CodigoAccesos.
     * @param {CodigoAccesoCreateManyArgs} args - Arguments to create many CodigoAccesos.
     * @example
     * // Create many CodigoAccesos
     * const codigoAcceso = await prisma.codigoAcceso.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CodigoAccesoCreateManyArgs>(args?: SelectSubset<T, CodigoAccesoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CodigoAccesos and returns the data saved in the database.
     * @param {CodigoAccesoCreateManyAndReturnArgs} args - Arguments to create many CodigoAccesos.
     * @example
     * // Create many CodigoAccesos
     * const codigoAcceso = await prisma.codigoAcceso.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CodigoAccesos and only return the `id`
     * const codigoAccesoWithIdOnly = await prisma.codigoAcceso.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CodigoAccesoCreateManyAndReturnArgs>(args?: SelectSubset<T, CodigoAccesoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CodigoAcceso.
     * @param {CodigoAccesoDeleteArgs} args - Arguments to delete one CodigoAcceso.
     * @example
     * // Delete one CodigoAcceso
     * const CodigoAcceso = await prisma.codigoAcceso.delete({
     *   where: {
     *     // ... filter to delete one CodigoAcceso
     *   }
     * })
     * 
     */
    delete<T extends CodigoAccesoDeleteArgs>(args: SelectSubset<T, CodigoAccesoDeleteArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CodigoAcceso.
     * @param {CodigoAccesoUpdateArgs} args - Arguments to update one CodigoAcceso.
     * @example
     * // Update one CodigoAcceso
     * const codigoAcceso = await prisma.codigoAcceso.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CodigoAccesoUpdateArgs>(args: SelectSubset<T, CodigoAccesoUpdateArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CodigoAccesos.
     * @param {CodigoAccesoDeleteManyArgs} args - Arguments to filter CodigoAccesos to delete.
     * @example
     * // Delete a few CodigoAccesos
     * const { count } = await prisma.codigoAcceso.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CodigoAccesoDeleteManyArgs>(args?: SelectSubset<T, CodigoAccesoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CodigoAccesos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CodigoAccesoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CodigoAccesos
     * const codigoAcceso = await prisma.codigoAcceso.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CodigoAccesoUpdateManyArgs>(args: SelectSubset<T, CodigoAccesoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CodigoAccesos and returns the data updated in the database.
     * @param {CodigoAccesoUpdateManyAndReturnArgs} args - Arguments to update many CodigoAccesos.
     * @example
     * // Update many CodigoAccesos
     * const codigoAcceso = await prisma.codigoAcceso.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CodigoAccesos and only return the `id`
     * const codigoAccesoWithIdOnly = await prisma.codigoAcceso.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CodigoAccesoUpdateManyAndReturnArgs>(args: SelectSubset<T, CodigoAccesoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CodigoAcceso.
     * @param {CodigoAccesoUpsertArgs} args - Arguments to update or create a CodigoAcceso.
     * @example
     * // Update or create a CodigoAcceso
     * const codigoAcceso = await prisma.codigoAcceso.upsert({
     *   create: {
     *     // ... data to create a CodigoAcceso
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CodigoAcceso we want to update
     *   }
     * })
     */
    upsert<T extends CodigoAccesoUpsertArgs>(args: SelectSubset<T, CodigoAccesoUpsertArgs<ExtArgs>>): Prisma__CodigoAccesoClient<$Result.GetResult<Prisma.$CodigoAccesoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CodigoAccesos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CodigoAccesoCountArgs} args - Arguments to filter CodigoAccesos to count.
     * @example
     * // Count the number of CodigoAccesos
     * const count = await prisma.codigoAcceso.count({
     *   where: {
     *     // ... the filter for the CodigoAccesos we want to count
     *   }
     * })
    **/
    count<T extends CodigoAccesoCountArgs>(
      args?: Subset<T, CodigoAccesoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CodigoAccesoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CodigoAcceso.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CodigoAccesoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CodigoAccesoAggregateArgs>(args: Subset<T, CodigoAccesoAggregateArgs>): Prisma.PrismaPromise<GetCodigoAccesoAggregateType<T>>

    /**
     * Group by CodigoAcceso.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CodigoAccesoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CodigoAccesoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CodigoAccesoGroupByArgs['orderBy'] }
        : { orderBy?: CodigoAccesoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CodigoAccesoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCodigoAccesoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CodigoAcceso model
   */
  readonly fields: CodigoAccesoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CodigoAcceso.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CodigoAccesoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CodigoAcceso model
   */
  interface CodigoAccesoFieldRefs {
    readonly id: FieldRef<"CodigoAcceso", 'String'>
    readonly periodoId: FieldRef<"CodigoAcceso", 'String'>
    readonly codigo: FieldRef<"CodigoAcceso", 'String'>
    readonly expiraEn: FieldRef<"CodigoAcceso", 'DateTime'>
    readonly usado: FieldRef<"CodigoAcceso", 'Boolean'>
    readonly createdAt: FieldRef<"CodigoAcceso", 'DateTime'>
    readonly updatedAt: FieldRef<"CodigoAcceso", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CodigoAcceso findUnique
   */
  export type CodigoAccesoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * Filter, which CodigoAcceso to fetch.
     */
    where: CodigoAccesoWhereUniqueInput
  }

  /**
   * CodigoAcceso findUniqueOrThrow
   */
  export type CodigoAccesoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * Filter, which CodigoAcceso to fetch.
     */
    where: CodigoAccesoWhereUniqueInput
  }

  /**
   * CodigoAcceso findFirst
   */
  export type CodigoAccesoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * Filter, which CodigoAcceso to fetch.
     */
    where?: CodigoAccesoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CodigoAccesos to fetch.
     */
    orderBy?: CodigoAccesoOrderByWithRelationInput | CodigoAccesoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CodigoAccesos.
     */
    cursor?: CodigoAccesoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CodigoAccesos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CodigoAccesos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CodigoAccesos.
     */
    distinct?: CodigoAccesoScalarFieldEnum | CodigoAccesoScalarFieldEnum[]
  }

  /**
   * CodigoAcceso findFirstOrThrow
   */
  export type CodigoAccesoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * Filter, which CodigoAcceso to fetch.
     */
    where?: CodigoAccesoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CodigoAccesos to fetch.
     */
    orderBy?: CodigoAccesoOrderByWithRelationInput | CodigoAccesoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CodigoAccesos.
     */
    cursor?: CodigoAccesoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CodigoAccesos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CodigoAccesos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CodigoAccesos.
     */
    distinct?: CodigoAccesoScalarFieldEnum | CodigoAccesoScalarFieldEnum[]
  }

  /**
   * CodigoAcceso findMany
   */
  export type CodigoAccesoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * Filter, which CodigoAccesos to fetch.
     */
    where?: CodigoAccesoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CodigoAccesos to fetch.
     */
    orderBy?: CodigoAccesoOrderByWithRelationInput | CodigoAccesoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CodigoAccesos.
     */
    cursor?: CodigoAccesoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CodigoAccesos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CodigoAccesos.
     */
    skip?: number
    distinct?: CodigoAccesoScalarFieldEnum | CodigoAccesoScalarFieldEnum[]
  }

  /**
   * CodigoAcceso create
   */
  export type CodigoAccesoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * The data needed to create a CodigoAcceso.
     */
    data: XOR<CodigoAccesoCreateInput, CodigoAccesoUncheckedCreateInput>
  }

  /**
   * CodigoAcceso createMany
   */
  export type CodigoAccesoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CodigoAccesos.
     */
    data: CodigoAccesoCreateManyInput | CodigoAccesoCreateManyInput[]
  }

  /**
   * CodigoAcceso createManyAndReturn
   */
  export type CodigoAccesoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * The data used to create many CodigoAccesos.
     */
    data: CodigoAccesoCreateManyInput | CodigoAccesoCreateManyInput[]
  }

  /**
   * CodigoAcceso update
   */
  export type CodigoAccesoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * The data needed to update a CodigoAcceso.
     */
    data: XOR<CodigoAccesoUpdateInput, CodigoAccesoUncheckedUpdateInput>
    /**
     * Choose, which CodigoAcceso to update.
     */
    where: CodigoAccesoWhereUniqueInput
  }

  /**
   * CodigoAcceso updateMany
   */
  export type CodigoAccesoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CodigoAccesos.
     */
    data: XOR<CodigoAccesoUpdateManyMutationInput, CodigoAccesoUncheckedUpdateManyInput>
    /**
     * Filter which CodigoAccesos to update
     */
    where?: CodigoAccesoWhereInput
    /**
     * Limit how many CodigoAccesos to update.
     */
    limit?: number
  }

  /**
   * CodigoAcceso updateManyAndReturn
   */
  export type CodigoAccesoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * The data used to update CodigoAccesos.
     */
    data: XOR<CodigoAccesoUpdateManyMutationInput, CodigoAccesoUncheckedUpdateManyInput>
    /**
     * Filter which CodigoAccesos to update
     */
    where?: CodigoAccesoWhereInput
    /**
     * Limit how many CodigoAccesos to update.
     */
    limit?: number
  }

  /**
   * CodigoAcceso upsert
   */
  export type CodigoAccesoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * The filter to search for the CodigoAcceso to update in case it exists.
     */
    where: CodigoAccesoWhereUniqueInput
    /**
     * In case the CodigoAcceso found by the `where` argument doesn't exist, create a new CodigoAcceso with this data.
     */
    create: XOR<CodigoAccesoCreateInput, CodigoAccesoUncheckedCreateInput>
    /**
     * In case the CodigoAcceso was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CodigoAccesoUpdateInput, CodigoAccesoUncheckedUpdateInput>
  }

  /**
   * CodigoAcceso delete
   */
  export type CodigoAccesoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
    /**
     * Filter which CodigoAcceso to delete.
     */
    where: CodigoAccesoWhereUniqueInput
  }

  /**
   * CodigoAcceso deleteMany
   */
  export type CodigoAccesoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CodigoAccesos to delete
     */
    where?: CodigoAccesoWhereInput
    /**
     * Limit how many CodigoAccesos to delete.
     */
    limit?: number
  }

  /**
   * CodigoAcceso without action
   */
  export type CodigoAccesoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CodigoAcceso
     */
    select?: CodigoAccesoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CodigoAcceso
     */
    omit?: CodigoAccesoOmit<ExtArgs> | null
  }


  /**
   * Model EventoUsoAlumno
   */

  export type AggregateEventoUsoAlumno = {
    _count: EventoUsoAlumnoCountAggregateOutputType | null
    _avg: EventoUsoAlumnoAvgAggregateOutputType | null
    _sum: EventoUsoAlumnoSumAggregateOutputType | null
    _min: EventoUsoAlumnoMinAggregateOutputType | null
    _max: EventoUsoAlumnoMaxAggregateOutputType | null
  }

  export type EventoUsoAlumnoAvgAggregateOutputType = {
    duracionMs: number | null
  }

  export type EventoUsoAlumnoSumAggregateOutputType = {
    duracionMs: number | null
  }

  export type EventoUsoAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    sessionId: string | null
    pantalla: string | null
    accion: string | null
    exito: boolean | null
    duracionMs: number | null
    meta: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type EventoUsoAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    sessionId: string | null
    pantalla: string | null
    accion: string | null
    exito: boolean | null
    duracionMs: number | null
    meta: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type EventoUsoAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    alumnoId: number
    sessionId: number
    pantalla: number
    accion: number
    exito: number
    duracionMs: number
    meta: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type EventoUsoAlumnoAvgAggregateInputType = {
    duracionMs?: true
  }

  export type EventoUsoAlumnoSumAggregateInputType = {
    duracionMs?: true
  }

  export type EventoUsoAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    sessionId?: true
    pantalla?: true
    accion?: true
    exito?: true
    duracionMs?: true
    meta?: true
    createdAt?: true
    updatedAt?: true
  }

  export type EventoUsoAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    sessionId?: true
    pantalla?: true
    accion?: true
    exito?: true
    duracionMs?: true
    meta?: true
    createdAt?: true
    updatedAt?: true
  }

  export type EventoUsoAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    sessionId?: true
    pantalla?: true
    accion?: true
    exito?: true
    duracionMs?: true
    meta?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type EventoUsoAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EventoUsoAlumno to aggregate.
     */
    where?: EventoUsoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EventoUsoAlumnos to fetch.
     */
    orderBy?: EventoUsoAlumnoOrderByWithRelationInput | EventoUsoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EventoUsoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EventoUsoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EventoUsoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned EventoUsoAlumnos
    **/
    _count?: true | EventoUsoAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: EventoUsoAlumnoAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: EventoUsoAlumnoSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EventoUsoAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EventoUsoAlumnoMaxAggregateInputType
  }

  export type GetEventoUsoAlumnoAggregateType<T extends EventoUsoAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregateEventoUsoAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEventoUsoAlumno[P]>
      : GetScalarType<T[P], AggregateEventoUsoAlumno[P]>
  }




  export type EventoUsoAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EventoUsoAlumnoWhereInput
    orderBy?: EventoUsoAlumnoOrderByWithAggregationInput | EventoUsoAlumnoOrderByWithAggregationInput[]
    by: EventoUsoAlumnoScalarFieldEnum[] | EventoUsoAlumnoScalarFieldEnum
    having?: EventoUsoAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EventoUsoAlumnoCountAggregateInputType | true
    _avg?: EventoUsoAlumnoAvgAggregateInputType
    _sum?: EventoUsoAlumnoSumAggregateInputType
    _min?: EventoUsoAlumnoMinAggregateInputType
    _max?: EventoUsoAlumnoMaxAggregateInputType
  }

  export type EventoUsoAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    alumnoId: string
    sessionId: string | null
    pantalla: string | null
    accion: string
    exito: boolean | null
    duracionMs: number | null
    meta: string | null
    createdAt: Date
    updatedAt: Date
    _count: EventoUsoAlumnoCountAggregateOutputType | null
    _avg: EventoUsoAlumnoAvgAggregateOutputType | null
    _sum: EventoUsoAlumnoSumAggregateOutputType | null
    _min: EventoUsoAlumnoMinAggregateOutputType | null
    _max: EventoUsoAlumnoMaxAggregateOutputType | null
  }

  type GetEventoUsoAlumnoGroupByPayload<T extends EventoUsoAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EventoUsoAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EventoUsoAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EventoUsoAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], EventoUsoAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type EventoUsoAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    sessionId?: boolean
    pantalla?: boolean
    accion?: boolean
    exito?: boolean
    duracionMs?: boolean
    meta?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["eventoUsoAlumno"]>

  export type EventoUsoAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    sessionId?: boolean
    pantalla?: boolean
    accion?: boolean
    exito?: boolean
    duracionMs?: boolean
    meta?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["eventoUsoAlumno"]>

  export type EventoUsoAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    sessionId?: boolean
    pantalla?: boolean
    accion?: boolean
    exito?: boolean
    duracionMs?: boolean
    meta?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["eventoUsoAlumno"]>

  export type EventoUsoAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    sessionId?: boolean
    pantalla?: boolean
    accion?: boolean
    exito?: boolean
    duracionMs?: boolean
    meta?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type EventoUsoAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "alumnoId" | "sessionId" | "pantalla" | "accion" | "exito" | "duracionMs" | "meta" | "createdAt" | "updatedAt", ExtArgs["result"]["eventoUsoAlumno"]>

  export type $EventoUsoAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "EventoUsoAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      alumnoId: string
      sessionId: string | null
      pantalla: string | null
      accion: string
      exito: boolean | null
      duracionMs: number | null
      meta: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["eventoUsoAlumno"]>
    composites: {}
  }

  type EventoUsoAlumnoGetPayload<S extends boolean | null | undefined | EventoUsoAlumnoDefaultArgs> = $Result.GetResult<Prisma.$EventoUsoAlumnoPayload, S>

  type EventoUsoAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EventoUsoAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EventoUsoAlumnoCountAggregateInputType | true
    }

  export interface EventoUsoAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['EventoUsoAlumno'], meta: { name: 'EventoUsoAlumno' } }
    /**
     * Find zero or one EventoUsoAlumno that matches the filter.
     * @param {EventoUsoAlumnoFindUniqueArgs} args - Arguments to find a EventoUsoAlumno
     * @example
     * // Get one EventoUsoAlumno
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EventoUsoAlumnoFindUniqueArgs>(args: SelectSubset<T, EventoUsoAlumnoFindUniqueArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one EventoUsoAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EventoUsoAlumnoFindUniqueOrThrowArgs} args - Arguments to find a EventoUsoAlumno
     * @example
     * // Get one EventoUsoAlumno
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EventoUsoAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, EventoUsoAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EventoUsoAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventoUsoAlumnoFindFirstArgs} args - Arguments to find a EventoUsoAlumno
     * @example
     * // Get one EventoUsoAlumno
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EventoUsoAlumnoFindFirstArgs>(args?: SelectSubset<T, EventoUsoAlumnoFindFirstArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EventoUsoAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventoUsoAlumnoFindFirstOrThrowArgs} args - Arguments to find a EventoUsoAlumno
     * @example
     * // Get one EventoUsoAlumno
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EventoUsoAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, EventoUsoAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more EventoUsoAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventoUsoAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all EventoUsoAlumnos
     * const eventoUsoAlumnos = await prisma.eventoUsoAlumno.findMany()
     * 
     * // Get first 10 EventoUsoAlumnos
     * const eventoUsoAlumnos = await prisma.eventoUsoAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const eventoUsoAlumnoWithIdOnly = await prisma.eventoUsoAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EventoUsoAlumnoFindManyArgs>(args?: SelectSubset<T, EventoUsoAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a EventoUsoAlumno.
     * @param {EventoUsoAlumnoCreateArgs} args - Arguments to create a EventoUsoAlumno.
     * @example
     * // Create one EventoUsoAlumno
     * const EventoUsoAlumno = await prisma.eventoUsoAlumno.create({
     *   data: {
     *     // ... data to create a EventoUsoAlumno
     *   }
     * })
     * 
     */
    create<T extends EventoUsoAlumnoCreateArgs>(args: SelectSubset<T, EventoUsoAlumnoCreateArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many EventoUsoAlumnos.
     * @param {EventoUsoAlumnoCreateManyArgs} args - Arguments to create many EventoUsoAlumnos.
     * @example
     * // Create many EventoUsoAlumnos
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EventoUsoAlumnoCreateManyArgs>(args?: SelectSubset<T, EventoUsoAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many EventoUsoAlumnos and returns the data saved in the database.
     * @param {EventoUsoAlumnoCreateManyAndReturnArgs} args - Arguments to create many EventoUsoAlumnos.
     * @example
     * // Create many EventoUsoAlumnos
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many EventoUsoAlumnos and only return the `id`
     * const eventoUsoAlumnoWithIdOnly = await prisma.eventoUsoAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EventoUsoAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, EventoUsoAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a EventoUsoAlumno.
     * @param {EventoUsoAlumnoDeleteArgs} args - Arguments to delete one EventoUsoAlumno.
     * @example
     * // Delete one EventoUsoAlumno
     * const EventoUsoAlumno = await prisma.eventoUsoAlumno.delete({
     *   where: {
     *     // ... filter to delete one EventoUsoAlumno
     *   }
     * })
     * 
     */
    delete<T extends EventoUsoAlumnoDeleteArgs>(args: SelectSubset<T, EventoUsoAlumnoDeleteArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one EventoUsoAlumno.
     * @param {EventoUsoAlumnoUpdateArgs} args - Arguments to update one EventoUsoAlumno.
     * @example
     * // Update one EventoUsoAlumno
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EventoUsoAlumnoUpdateArgs>(args: SelectSubset<T, EventoUsoAlumnoUpdateArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more EventoUsoAlumnos.
     * @param {EventoUsoAlumnoDeleteManyArgs} args - Arguments to filter EventoUsoAlumnos to delete.
     * @example
     * // Delete a few EventoUsoAlumnos
     * const { count } = await prisma.eventoUsoAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EventoUsoAlumnoDeleteManyArgs>(args?: SelectSubset<T, EventoUsoAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EventoUsoAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventoUsoAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many EventoUsoAlumnos
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EventoUsoAlumnoUpdateManyArgs>(args: SelectSubset<T, EventoUsoAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EventoUsoAlumnos and returns the data updated in the database.
     * @param {EventoUsoAlumnoUpdateManyAndReturnArgs} args - Arguments to update many EventoUsoAlumnos.
     * @example
     * // Update many EventoUsoAlumnos
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more EventoUsoAlumnos and only return the `id`
     * const eventoUsoAlumnoWithIdOnly = await prisma.eventoUsoAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EventoUsoAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, EventoUsoAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one EventoUsoAlumno.
     * @param {EventoUsoAlumnoUpsertArgs} args - Arguments to update or create a EventoUsoAlumno.
     * @example
     * // Update or create a EventoUsoAlumno
     * const eventoUsoAlumno = await prisma.eventoUsoAlumno.upsert({
     *   create: {
     *     // ... data to create a EventoUsoAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the EventoUsoAlumno we want to update
     *   }
     * })
     */
    upsert<T extends EventoUsoAlumnoUpsertArgs>(args: SelectSubset<T, EventoUsoAlumnoUpsertArgs<ExtArgs>>): Prisma__EventoUsoAlumnoClient<$Result.GetResult<Prisma.$EventoUsoAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of EventoUsoAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventoUsoAlumnoCountArgs} args - Arguments to filter EventoUsoAlumnos to count.
     * @example
     * // Count the number of EventoUsoAlumnos
     * const count = await prisma.eventoUsoAlumno.count({
     *   where: {
     *     // ... the filter for the EventoUsoAlumnos we want to count
     *   }
     * })
    **/
    count<T extends EventoUsoAlumnoCountArgs>(
      args?: Subset<T, EventoUsoAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EventoUsoAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a EventoUsoAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventoUsoAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EventoUsoAlumnoAggregateArgs>(args: Subset<T, EventoUsoAlumnoAggregateArgs>): Prisma.PrismaPromise<GetEventoUsoAlumnoAggregateType<T>>

    /**
     * Group by EventoUsoAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventoUsoAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EventoUsoAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EventoUsoAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: EventoUsoAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EventoUsoAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEventoUsoAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the EventoUsoAlumno model
   */
  readonly fields: EventoUsoAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for EventoUsoAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EventoUsoAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the EventoUsoAlumno model
   */
  interface EventoUsoAlumnoFieldRefs {
    readonly id: FieldRef<"EventoUsoAlumno", 'String'>
    readonly periodoId: FieldRef<"EventoUsoAlumno", 'String'>
    readonly alumnoId: FieldRef<"EventoUsoAlumno", 'String'>
    readonly sessionId: FieldRef<"EventoUsoAlumno", 'String'>
    readonly pantalla: FieldRef<"EventoUsoAlumno", 'String'>
    readonly accion: FieldRef<"EventoUsoAlumno", 'String'>
    readonly exito: FieldRef<"EventoUsoAlumno", 'Boolean'>
    readonly duracionMs: FieldRef<"EventoUsoAlumno", 'Int'>
    readonly meta: FieldRef<"EventoUsoAlumno", 'String'>
    readonly createdAt: FieldRef<"EventoUsoAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"EventoUsoAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * EventoUsoAlumno findUnique
   */
  export type EventoUsoAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which EventoUsoAlumno to fetch.
     */
    where: EventoUsoAlumnoWhereUniqueInput
  }

  /**
   * EventoUsoAlumno findUniqueOrThrow
   */
  export type EventoUsoAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which EventoUsoAlumno to fetch.
     */
    where: EventoUsoAlumnoWhereUniqueInput
  }

  /**
   * EventoUsoAlumno findFirst
   */
  export type EventoUsoAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which EventoUsoAlumno to fetch.
     */
    where?: EventoUsoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EventoUsoAlumnos to fetch.
     */
    orderBy?: EventoUsoAlumnoOrderByWithRelationInput | EventoUsoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EventoUsoAlumnos.
     */
    cursor?: EventoUsoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EventoUsoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EventoUsoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EventoUsoAlumnos.
     */
    distinct?: EventoUsoAlumnoScalarFieldEnum | EventoUsoAlumnoScalarFieldEnum[]
  }

  /**
   * EventoUsoAlumno findFirstOrThrow
   */
  export type EventoUsoAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which EventoUsoAlumno to fetch.
     */
    where?: EventoUsoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EventoUsoAlumnos to fetch.
     */
    orderBy?: EventoUsoAlumnoOrderByWithRelationInput | EventoUsoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EventoUsoAlumnos.
     */
    cursor?: EventoUsoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EventoUsoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EventoUsoAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EventoUsoAlumnos.
     */
    distinct?: EventoUsoAlumnoScalarFieldEnum | EventoUsoAlumnoScalarFieldEnum[]
  }

  /**
   * EventoUsoAlumno findMany
   */
  export type EventoUsoAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which EventoUsoAlumnos to fetch.
     */
    where?: EventoUsoAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EventoUsoAlumnos to fetch.
     */
    orderBy?: EventoUsoAlumnoOrderByWithRelationInput | EventoUsoAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing EventoUsoAlumnos.
     */
    cursor?: EventoUsoAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EventoUsoAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EventoUsoAlumnos.
     */
    skip?: number
    distinct?: EventoUsoAlumnoScalarFieldEnum | EventoUsoAlumnoScalarFieldEnum[]
  }

  /**
   * EventoUsoAlumno create
   */
  export type EventoUsoAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a EventoUsoAlumno.
     */
    data: XOR<EventoUsoAlumnoCreateInput, EventoUsoAlumnoUncheckedCreateInput>
  }

  /**
   * EventoUsoAlumno createMany
   */
  export type EventoUsoAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many EventoUsoAlumnos.
     */
    data: EventoUsoAlumnoCreateManyInput | EventoUsoAlumnoCreateManyInput[]
  }

  /**
   * EventoUsoAlumno createManyAndReturn
   */
  export type EventoUsoAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many EventoUsoAlumnos.
     */
    data: EventoUsoAlumnoCreateManyInput | EventoUsoAlumnoCreateManyInput[]
  }

  /**
   * EventoUsoAlumno update
   */
  export type EventoUsoAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a EventoUsoAlumno.
     */
    data: XOR<EventoUsoAlumnoUpdateInput, EventoUsoAlumnoUncheckedUpdateInput>
    /**
     * Choose, which EventoUsoAlumno to update.
     */
    where: EventoUsoAlumnoWhereUniqueInput
  }

  /**
   * EventoUsoAlumno updateMany
   */
  export type EventoUsoAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update EventoUsoAlumnos.
     */
    data: XOR<EventoUsoAlumnoUpdateManyMutationInput, EventoUsoAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which EventoUsoAlumnos to update
     */
    where?: EventoUsoAlumnoWhereInput
    /**
     * Limit how many EventoUsoAlumnos to update.
     */
    limit?: number
  }

  /**
   * EventoUsoAlumno updateManyAndReturn
   */
  export type EventoUsoAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update EventoUsoAlumnos.
     */
    data: XOR<EventoUsoAlumnoUpdateManyMutationInput, EventoUsoAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which EventoUsoAlumnos to update
     */
    where?: EventoUsoAlumnoWhereInput
    /**
     * Limit how many EventoUsoAlumnos to update.
     */
    limit?: number
  }

  /**
   * EventoUsoAlumno upsert
   */
  export type EventoUsoAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the EventoUsoAlumno to update in case it exists.
     */
    where: EventoUsoAlumnoWhereUniqueInput
    /**
     * In case the EventoUsoAlumno found by the `where` argument doesn't exist, create a new EventoUsoAlumno with this data.
     */
    create: XOR<EventoUsoAlumnoCreateInput, EventoUsoAlumnoUncheckedCreateInput>
    /**
     * In case the EventoUsoAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EventoUsoAlumnoUpdateInput, EventoUsoAlumnoUncheckedUpdateInput>
  }

  /**
   * EventoUsoAlumno delete
   */
  export type EventoUsoAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
    /**
     * Filter which EventoUsoAlumno to delete.
     */
    where: EventoUsoAlumnoWhereUniqueInput
  }

  /**
   * EventoUsoAlumno deleteMany
   */
  export type EventoUsoAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EventoUsoAlumnos to delete
     */
    where?: EventoUsoAlumnoWhereInput
    /**
     * Limit how many EventoUsoAlumnos to delete.
     */
    limit?: number
  }

  /**
   * EventoUsoAlumno without action
   */
  export type EventoUsoAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EventoUsoAlumno
     */
    select?: EventoUsoAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EventoUsoAlumno
     */
    omit?: EventoUsoAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model SesionAlumno
   */

  export type AggregateSesionAlumno = {
    _count: SesionAlumnoCountAggregateOutputType | null
    _min: SesionAlumnoMinAggregateOutputType | null
    _max: SesionAlumnoMaxAggregateOutputType | null
  }

  export type SesionAlumnoMinAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    tokenHash: string | null
    expiraEn: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SesionAlumnoMaxAggregateOutputType = {
    id: string | null
    periodoId: string | null
    alumnoId: string | null
    tokenHash: string | null
    expiraEn: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SesionAlumnoCountAggregateOutputType = {
    id: number
    periodoId: number
    alumnoId: number
    tokenHash: number
    expiraEn: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SesionAlumnoMinAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    tokenHash?: true
    expiraEn?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SesionAlumnoMaxAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    tokenHash?: true
    expiraEn?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SesionAlumnoCountAggregateInputType = {
    id?: true
    periodoId?: true
    alumnoId?: true
    tokenHash?: true
    expiraEn?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SesionAlumnoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SesionAlumno to aggregate.
     */
    where?: SesionAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SesionAlumnos to fetch.
     */
    orderBy?: SesionAlumnoOrderByWithRelationInput | SesionAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SesionAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SesionAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SesionAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SesionAlumnos
    **/
    _count?: true | SesionAlumnoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SesionAlumnoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SesionAlumnoMaxAggregateInputType
  }

  export type GetSesionAlumnoAggregateType<T extends SesionAlumnoAggregateArgs> = {
        [P in keyof T & keyof AggregateSesionAlumno]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSesionAlumno[P]>
      : GetScalarType<T[P], AggregateSesionAlumno[P]>
  }




  export type SesionAlumnoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SesionAlumnoWhereInput
    orderBy?: SesionAlumnoOrderByWithAggregationInput | SesionAlumnoOrderByWithAggregationInput[]
    by: SesionAlumnoScalarFieldEnum[] | SesionAlumnoScalarFieldEnum
    having?: SesionAlumnoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SesionAlumnoCountAggregateInputType | true
    _min?: SesionAlumnoMinAggregateInputType
    _max?: SesionAlumnoMaxAggregateInputType
  }

  export type SesionAlumnoGroupByOutputType = {
    id: string
    periodoId: string
    alumnoId: string
    tokenHash: string
    expiraEn: Date
    createdAt: Date
    updatedAt: Date
    _count: SesionAlumnoCountAggregateOutputType | null
    _min: SesionAlumnoMinAggregateOutputType | null
    _max: SesionAlumnoMaxAggregateOutputType | null
  }

  type GetSesionAlumnoGroupByPayload<T extends SesionAlumnoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SesionAlumnoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SesionAlumnoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SesionAlumnoGroupByOutputType[P]>
            : GetScalarType<T[P], SesionAlumnoGroupByOutputType[P]>
        }
      >
    >


  export type SesionAlumnoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    tokenHash?: boolean
    expiraEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["sesionAlumno"]>

  export type SesionAlumnoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    tokenHash?: boolean
    expiraEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["sesionAlumno"]>

  export type SesionAlumnoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    tokenHash?: boolean
    expiraEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["sesionAlumno"]>

  export type SesionAlumnoSelectScalar = {
    id?: boolean
    periodoId?: boolean
    alumnoId?: boolean
    tokenHash?: boolean
    expiraEn?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SesionAlumnoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "periodoId" | "alumnoId" | "tokenHash" | "expiraEn" | "createdAt" | "updatedAt", ExtArgs["result"]["sesionAlumno"]>

  export type $SesionAlumnoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SesionAlumno"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      periodoId: string
      alumnoId: string
      tokenHash: string
      expiraEn: Date
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["sesionAlumno"]>
    composites: {}
  }

  type SesionAlumnoGetPayload<S extends boolean | null | undefined | SesionAlumnoDefaultArgs> = $Result.GetResult<Prisma.$SesionAlumnoPayload, S>

  type SesionAlumnoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SesionAlumnoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SesionAlumnoCountAggregateInputType | true
    }

  export interface SesionAlumnoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SesionAlumno'], meta: { name: 'SesionAlumno' } }
    /**
     * Find zero or one SesionAlumno that matches the filter.
     * @param {SesionAlumnoFindUniqueArgs} args - Arguments to find a SesionAlumno
     * @example
     * // Get one SesionAlumno
     * const sesionAlumno = await prisma.sesionAlumno.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SesionAlumnoFindUniqueArgs>(args: SelectSubset<T, SesionAlumnoFindUniqueArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SesionAlumno that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SesionAlumnoFindUniqueOrThrowArgs} args - Arguments to find a SesionAlumno
     * @example
     * // Get one SesionAlumno
     * const sesionAlumno = await prisma.sesionAlumno.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SesionAlumnoFindUniqueOrThrowArgs>(args: SelectSubset<T, SesionAlumnoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SesionAlumno that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SesionAlumnoFindFirstArgs} args - Arguments to find a SesionAlumno
     * @example
     * // Get one SesionAlumno
     * const sesionAlumno = await prisma.sesionAlumno.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SesionAlumnoFindFirstArgs>(args?: SelectSubset<T, SesionAlumnoFindFirstArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SesionAlumno that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SesionAlumnoFindFirstOrThrowArgs} args - Arguments to find a SesionAlumno
     * @example
     * // Get one SesionAlumno
     * const sesionAlumno = await prisma.sesionAlumno.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SesionAlumnoFindFirstOrThrowArgs>(args?: SelectSubset<T, SesionAlumnoFindFirstOrThrowArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SesionAlumnos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SesionAlumnoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SesionAlumnos
     * const sesionAlumnos = await prisma.sesionAlumno.findMany()
     * 
     * // Get first 10 SesionAlumnos
     * const sesionAlumnos = await prisma.sesionAlumno.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sesionAlumnoWithIdOnly = await prisma.sesionAlumno.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SesionAlumnoFindManyArgs>(args?: SelectSubset<T, SesionAlumnoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SesionAlumno.
     * @param {SesionAlumnoCreateArgs} args - Arguments to create a SesionAlumno.
     * @example
     * // Create one SesionAlumno
     * const SesionAlumno = await prisma.sesionAlumno.create({
     *   data: {
     *     // ... data to create a SesionAlumno
     *   }
     * })
     * 
     */
    create<T extends SesionAlumnoCreateArgs>(args: SelectSubset<T, SesionAlumnoCreateArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SesionAlumnos.
     * @param {SesionAlumnoCreateManyArgs} args - Arguments to create many SesionAlumnos.
     * @example
     * // Create many SesionAlumnos
     * const sesionAlumno = await prisma.sesionAlumno.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SesionAlumnoCreateManyArgs>(args?: SelectSubset<T, SesionAlumnoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SesionAlumnos and returns the data saved in the database.
     * @param {SesionAlumnoCreateManyAndReturnArgs} args - Arguments to create many SesionAlumnos.
     * @example
     * // Create many SesionAlumnos
     * const sesionAlumno = await prisma.sesionAlumno.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SesionAlumnos and only return the `id`
     * const sesionAlumnoWithIdOnly = await prisma.sesionAlumno.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SesionAlumnoCreateManyAndReturnArgs>(args?: SelectSubset<T, SesionAlumnoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SesionAlumno.
     * @param {SesionAlumnoDeleteArgs} args - Arguments to delete one SesionAlumno.
     * @example
     * // Delete one SesionAlumno
     * const SesionAlumno = await prisma.sesionAlumno.delete({
     *   where: {
     *     // ... filter to delete one SesionAlumno
     *   }
     * })
     * 
     */
    delete<T extends SesionAlumnoDeleteArgs>(args: SelectSubset<T, SesionAlumnoDeleteArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SesionAlumno.
     * @param {SesionAlumnoUpdateArgs} args - Arguments to update one SesionAlumno.
     * @example
     * // Update one SesionAlumno
     * const sesionAlumno = await prisma.sesionAlumno.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SesionAlumnoUpdateArgs>(args: SelectSubset<T, SesionAlumnoUpdateArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SesionAlumnos.
     * @param {SesionAlumnoDeleteManyArgs} args - Arguments to filter SesionAlumnos to delete.
     * @example
     * // Delete a few SesionAlumnos
     * const { count } = await prisma.sesionAlumno.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SesionAlumnoDeleteManyArgs>(args?: SelectSubset<T, SesionAlumnoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SesionAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SesionAlumnoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SesionAlumnos
     * const sesionAlumno = await prisma.sesionAlumno.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SesionAlumnoUpdateManyArgs>(args: SelectSubset<T, SesionAlumnoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SesionAlumnos and returns the data updated in the database.
     * @param {SesionAlumnoUpdateManyAndReturnArgs} args - Arguments to update many SesionAlumnos.
     * @example
     * // Update many SesionAlumnos
     * const sesionAlumno = await prisma.sesionAlumno.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SesionAlumnos and only return the `id`
     * const sesionAlumnoWithIdOnly = await prisma.sesionAlumno.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SesionAlumnoUpdateManyAndReturnArgs>(args: SelectSubset<T, SesionAlumnoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SesionAlumno.
     * @param {SesionAlumnoUpsertArgs} args - Arguments to update or create a SesionAlumno.
     * @example
     * // Update or create a SesionAlumno
     * const sesionAlumno = await prisma.sesionAlumno.upsert({
     *   create: {
     *     // ... data to create a SesionAlumno
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SesionAlumno we want to update
     *   }
     * })
     */
    upsert<T extends SesionAlumnoUpsertArgs>(args: SelectSubset<T, SesionAlumnoUpsertArgs<ExtArgs>>): Prisma__SesionAlumnoClient<$Result.GetResult<Prisma.$SesionAlumnoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SesionAlumnos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SesionAlumnoCountArgs} args - Arguments to filter SesionAlumnos to count.
     * @example
     * // Count the number of SesionAlumnos
     * const count = await prisma.sesionAlumno.count({
     *   where: {
     *     // ... the filter for the SesionAlumnos we want to count
     *   }
     * })
    **/
    count<T extends SesionAlumnoCountArgs>(
      args?: Subset<T, SesionAlumnoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SesionAlumnoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SesionAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SesionAlumnoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SesionAlumnoAggregateArgs>(args: Subset<T, SesionAlumnoAggregateArgs>): Prisma.PrismaPromise<GetSesionAlumnoAggregateType<T>>

    /**
     * Group by SesionAlumno.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SesionAlumnoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SesionAlumnoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SesionAlumnoGroupByArgs['orderBy'] }
        : { orderBy?: SesionAlumnoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SesionAlumnoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSesionAlumnoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SesionAlumno model
   */
  readonly fields: SesionAlumnoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SesionAlumno.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SesionAlumnoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SesionAlumno model
   */
  interface SesionAlumnoFieldRefs {
    readonly id: FieldRef<"SesionAlumno", 'String'>
    readonly periodoId: FieldRef<"SesionAlumno", 'String'>
    readonly alumnoId: FieldRef<"SesionAlumno", 'String'>
    readonly tokenHash: FieldRef<"SesionAlumno", 'String'>
    readonly expiraEn: FieldRef<"SesionAlumno", 'DateTime'>
    readonly createdAt: FieldRef<"SesionAlumno", 'DateTime'>
    readonly updatedAt: FieldRef<"SesionAlumno", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SesionAlumno findUnique
   */
  export type SesionAlumnoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which SesionAlumno to fetch.
     */
    where: SesionAlumnoWhereUniqueInput
  }

  /**
   * SesionAlumno findUniqueOrThrow
   */
  export type SesionAlumnoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which SesionAlumno to fetch.
     */
    where: SesionAlumnoWhereUniqueInput
  }

  /**
   * SesionAlumno findFirst
   */
  export type SesionAlumnoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which SesionAlumno to fetch.
     */
    where?: SesionAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SesionAlumnos to fetch.
     */
    orderBy?: SesionAlumnoOrderByWithRelationInput | SesionAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SesionAlumnos.
     */
    cursor?: SesionAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SesionAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SesionAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SesionAlumnos.
     */
    distinct?: SesionAlumnoScalarFieldEnum | SesionAlumnoScalarFieldEnum[]
  }

  /**
   * SesionAlumno findFirstOrThrow
   */
  export type SesionAlumnoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which SesionAlumno to fetch.
     */
    where?: SesionAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SesionAlumnos to fetch.
     */
    orderBy?: SesionAlumnoOrderByWithRelationInput | SesionAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SesionAlumnos.
     */
    cursor?: SesionAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SesionAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SesionAlumnos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SesionAlumnos.
     */
    distinct?: SesionAlumnoScalarFieldEnum | SesionAlumnoScalarFieldEnum[]
  }

  /**
   * SesionAlumno findMany
   */
  export type SesionAlumnoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * Filter, which SesionAlumnos to fetch.
     */
    where?: SesionAlumnoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SesionAlumnos to fetch.
     */
    orderBy?: SesionAlumnoOrderByWithRelationInput | SesionAlumnoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SesionAlumnos.
     */
    cursor?: SesionAlumnoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SesionAlumnos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SesionAlumnos.
     */
    skip?: number
    distinct?: SesionAlumnoScalarFieldEnum | SesionAlumnoScalarFieldEnum[]
  }

  /**
   * SesionAlumno create
   */
  export type SesionAlumnoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to create a SesionAlumno.
     */
    data: XOR<SesionAlumnoCreateInput, SesionAlumnoUncheckedCreateInput>
  }

  /**
   * SesionAlumno createMany
   */
  export type SesionAlumnoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SesionAlumnos.
     */
    data: SesionAlumnoCreateManyInput | SesionAlumnoCreateManyInput[]
  }

  /**
   * SesionAlumno createManyAndReturn
   */
  export type SesionAlumnoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * The data used to create many SesionAlumnos.
     */
    data: SesionAlumnoCreateManyInput | SesionAlumnoCreateManyInput[]
  }

  /**
   * SesionAlumno update
   */
  export type SesionAlumnoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * The data needed to update a SesionAlumno.
     */
    data: XOR<SesionAlumnoUpdateInput, SesionAlumnoUncheckedUpdateInput>
    /**
     * Choose, which SesionAlumno to update.
     */
    where: SesionAlumnoWhereUniqueInput
  }

  /**
   * SesionAlumno updateMany
   */
  export type SesionAlumnoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SesionAlumnos.
     */
    data: XOR<SesionAlumnoUpdateManyMutationInput, SesionAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which SesionAlumnos to update
     */
    where?: SesionAlumnoWhereInput
    /**
     * Limit how many SesionAlumnos to update.
     */
    limit?: number
  }

  /**
   * SesionAlumno updateManyAndReturn
   */
  export type SesionAlumnoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * The data used to update SesionAlumnos.
     */
    data: XOR<SesionAlumnoUpdateManyMutationInput, SesionAlumnoUncheckedUpdateManyInput>
    /**
     * Filter which SesionAlumnos to update
     */
    where?: SesionAlumnoWhereInput
    /**
     * Limit how many SesionAlumnos to update.
     */
    limit?: number
  }

  /**
   * SesionAlumno upsert
   */
  export type SesionAlumnoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * The filter to search for the SesionAlumno to update in case it exists.
     */
    where: SesionAlumnoWhereUniqueInput
    /**
     * In case the SesionAlumno found by the `where` argument doesn't exist, create a new SesionAlumno with this data.
     */
    create: XOR<SesionAlumnoCreateInput, SesionAlumnoUncheckedCreateInput>
    /**
     * In case the SesionAlumno was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SesionAlumnoUpdateInput, SesionAlumnoUncheckedUpdateInput>
  }

  /**
   * SesionAlumno delete
   */
  export type SesionAlumnoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
    /**
     * Filter which SesionAlumno to delete.
     */
    where: SesionAlumnoWhereUniqueInput
  }

  /**
   * SesionAlumno deleteMany
   */
  export type SesionAlumnoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SesionAlumnos to delete
     */
    where?: SesionAlumnoWhereInput
    /**
     * Limit how many SesionAlumnos to delete.
     */
    limit?: number
  }

  /**
   * SesionAlumno without action
   */
  export type SesionAlumnoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SesionAlumno
     */
    select?: SesionAlumnoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SesionAlumno
     */
    omit?: SesionAlumnoOmit<ExtArgs> | null
  }


  /**
   * Model SolicitudRevision
   */

  export type AggregateSolicitudRevision = {
    _count: SolicitudRevisionCountAggregateOutputType | null
    _avg: SolicitudRevisionAvgAggregateOutputType | null
    _sum: SolicitudRevisionSumAggregateOutputType | null
    _min: SolicitudRevisionMinAggregateOutputType | null
    _max: SolicitudRevisionMaxAggregateOutputType | null
  }

  export type SolicitudRevisionAvgAggregateOutputType = {
    numeroPregunta: number | null
  }

  export type SolicitudRevisionSumAggregateOutputType = {
    numeroPregunta: number | null
  }

  export type SolicitudRevisionMinAggregateOutputType = {
    id: string | null
    externoId: string | null
    periodoId: string | null
    docenteId: string | null
    alumnoId: string | null
    examenGeneradoId: string | null
    folio: string | null
    numeroPregunta: number | null
    comentario: string | null
    estado: string | null
    solicitadoEn: Date | null
    atendidoEn: Date | null
    respuestaDocente: string | null
    firmaDocente: string | null
    firmadoEn: Date | null
    cerradoEn: Date | null
    conformidadAlumno: boolean | null
    conformidadActualizadaEn: Date | null
    origen: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SolicitudRevisionMaxAggregateOutputType = {
    id: string | null
    externoId: string | null
    periodoId: string | null
    docenteId: string | null
    alumnoId: string | null
    examenGeneradoId: string | null
    folio: string | null
    numeroPregunta: number | null
    comentario: string | null
    estado: string | null
    solicitadoEn: Date | null
    atendidoEn: Date | null
    respuestaDocente: string | null
    firmaDocente: string | null
    firmadoEn: Date | null
    cerradoEn: Date | null
    conformidadAlumno: boolean | null
    conformidadActualizadaEn: Date | null
    origen: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SolicitudRevisionCountAggregateOutputType = {
    id: number
    externoId: number
    periodoId: number
    docenteId: number
    alumnoId: number
    examenGeneradoId: number
    folio: number
    numeroPregunta: number
    comentario: number
    estado: number
    solicitadoEn: number
    atendidoEn: number
    respuestaDocente: number
    firmaDocente: number
    firmadoEn: number
    cerradoEn: number
    conformidadAlumno: number
    conformidadActualizadaEn: number
    origen: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SolicitudRevisionAvgAggregateInputType = {
    numeroPregunta?: true
  }

  export type SolicitudRevisionSumAggregateInputType = {
    numeroPregunta?: true
  }

  export type SolicitudRevisionMinAggregateInputType = {
    id?: true
    externoId?: true
    periodoId?: true
    docenteId?: true
    alumnoId?: true
    examenGeneradoId?: true
    folio?: true
    numeroPregunta?: true
    comentario?: true
    estado?: true
    solicitadoEn?: true
    atendidoEn?: true
    respuestaDocente?: true
    firmaDocente?: true
    firmadoEn?: true
    cerradoEn?: true
    conformidadAlumno?: true
    conformidadActualizadaEn?: true
    origen?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SolicitudRevisionMaxAggregateInputType = {
    id?: true
    externoId?: true
    periodoId?: true
    docenteId?: true
    alumnoId?: true
    examenGeneradoId?: true
    folio?: true
    numeroPregunta?: true
    comentario?: true
    estado?: true
    solicitadoEn?: true
    atendidoEn?: true
    respuestaDocente?: true
    firmaDocente?: true
    firmadoEn?: true
    cerradoEn?: true
    conformidadAlumno?: true
    conformidadActualizadaEn?: true
    origen?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SolicitudRevisionCountAggregateInputType = {
    id?: true
    externoId?: true
    periodoId?: true
    docenteId?: true
    alumnoId?: true
    examenGeneradoId?: true
    folio?: true
    numeroPregunta?: true
    comentario?: true
    estado?: true
    solicitadoEn?: true
    atendidoEn?: true
    respuestaDocente?: true
    firmaDocente?: true
    firmadoEn?: true
    cerradoEn?: true
    conformidadAlumno?: true
    conformidadActualizadaEn?: true
    origen?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SolicitudRevisionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SolicitudRevision to aggregate.
     */
    where?: SolicitudRevisionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SolicitudRevisions to fetch.
     */
    orderBy?: SolicitudRevisionOrderByWithRelationInput | SolicitudRevisionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SolicitudRevisionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SolicitudRevisions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SolicitudRevisions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SolicitudRevisions
    **/
    _count?: true | SolicitudRevisionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SolicitudRevisionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SolicitudRevisionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SolicitudRevisionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SolicitudRevisionMaxAggregateInputType
  }

  export type GetSolicitudRevisionAggregateType<T extends SolicitudRevisionAggregateArgs> = {
        [P in keyof T & keyof AggregateSolicitudRevision]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSolicitudRevision[P]>
      : GetScalarType<T[P], AggregateSolicitudRevision[P]>
  }




  export type SolicitudRevisionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SolicitudRevisionWhereInput
    orderBy?: SolicitudRevisionOrderByWithAggregationInput | SolicitudRevisionOrderByWithAggregationInput[]
    by: SolicitudRevisionScalarFieldEnum[] | SolicitudRevisionScalarFieldEnum
    having?: SolicitudRevisionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SolicitudRevisionCountAggregateInputType | true
    _avg?: SolicitudRevisionAvgAggregateInputType
    _sum?: SolicitudRevisionSumAggregateInputType
    _min?: SolicitudRevisionMinAggregateInputType
    _max?: SolicitudRevisionMaxAggregateInputType
  }

  export type SolicitudRevisionGroupByOutputType = {
    id: string
    externoId: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId: string | null
    folio: string
    numeroPregunta: number
    comentario: string | null
    estado: string
    solicitadoEn: Date
    atendidoEn: Date | null
    respuestaDocente: string | null
    firmaDocente: string | null
    firmadoEn: Date | null
    cerradoEn: Date | null
    conformidadAlumno: boolean
    conformidadActualizadaEn: Date | null
    origen: string
    createdAt: Date
    updatedAt: Date
    _count: SolicitudRevisionCountAggregateOutputType | null
    _avg: SolicitudRevisionAvgAggregateOutputType | null
    _sum: SolicitudRevisionSumAggregateOutputType | null
    _min: SolicitudRevisionMinAggregateOutputType | null
    _max: SolicitudRevisionMaxAggregateOutputType | null
  }

  type GetSolicitudRevisionGroupByPayload<T extends SolicitudRevisionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SolicitudRevisionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SolicitudRevisionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SolicitudRevisionGroupByOutputType[P]>
            : GetScalarType<T[P], SolicitudRevisionGroupByOutputType[P]>
        }
      >
    >


  export type SolicitudRevisionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    externoId?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    folio?: boolean
    numeroPregunta?: boolean
    comentario?: boolean
    estado?: boolean
    solicitadoEn?: boolean
    atendidoEn?: boolean
    respuestaDocente?: boolean
    firmaDocente?: boolean
    firmadoEn?: boolean
    cerradoEn?: boolean
    conformidadAlumno?: boolean
    conformidadActualizadaEn?: boolean
    origen?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["solicitudRevision"]>

  export type SolicitudRevisionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    externoId?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    folio?: boolean
    numeroPregunta?: boolean
    comentario?: boolean
    estado?: boolean
    solicitadoEn?: boolean
    atendidoEn?: boolean
    respuestaDocente?: boolean
    firmaDocente?: boolean
    firmadoEn?: boolean
    cerradoEn?: boolean
    conformidadAlumno?: boolean
    conformidadActualizadaEn?: boolean
    origen?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["solicitudRevision"]>

  export type SolicitudRevisionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    externoId?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    folio?: boolean
    numeroPregunta?: boolean
    comentario?: boolean
    estado?: boolean
    solicitadoEn?: boolean
    atendidoEn?: boolean
    respuestaDocente?: boolean
    firmaDocente?: boolean
    firmadoEn?: boolean
    cerradoEn?: boolean
    conformidadAlumno?: boolean
    conformidadActualizadaEn?: boolean
    origen?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["solicitudRevision"]>

  export type SolicitudRevisionSelectScalar = {
    id?: boolean
    externoId?: boolean
    periodoId?: boolean
    docenteId?: boolean
    alumnoId?: boolean
    examenGeneradoId?: boolean
    folio?: boolean
    numeroPregunta?: boolean
    comentario?: boolean
    estado?: boolean
    solicitadoEn?: boolean
    atendidoEn?: boolean
    respuestaDocente?: boolean
    firmaDocente?: boolean
    firmadoEn?: boolean
    cerradoEn?: boolean
    conformidadAlumno?: boolean
    conformidadActualizadaEn?: boolean
    origen?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SolicitudRevisionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "externoId" | "periodoId" | "docenteId" | "alumnoId" | "examenGeneradoId" | "folio" | "numeroPregunta" | "comentario" | "estado" | "solicitadoEn" | "atendidoEn" | "respuestaDocente" | "firmaDocente" | "firmadoEn" | "cerradoEn" | "conformidadAlumno" | "conformidadActualizadaEn" | "origen" | "createdAt" | "updatedAt", ExtArgs["result"]["solicitudRevision"]>

  export type $SolicitudRevisionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SolicitudRevision"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      externoId: string
      periodoId: string
      docenteId: string
      alumnoId: string
      examenGeneradoId: string | null
      folio: string
      numeroPregunta: number
      comentario: string | null
      estado: string
      solicitadoEn: Date
      atendidoEn: Date | null
      respuestaDocente: string | null
      firmaDocente: string | null
      firmadoEn: Date | null
      cerradoEn: Date | null
      conformidadAlumno: boolean
      conformidadActualizadaEn: Date | null
      origen: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["solicitudRevision"]>
    composites: {}
  }

  type SolicitudRevisionGetPayload<S extends boolean | null | undefined | SolicitudRevisionDefaultArgs> = $Result.GetResult<Prisma.$SolicitudRevisionPayload, S>

  type SolicitudRevisionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SolicitudRevisionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SolicitudRevisionCountAggregateInputType | true
    }

  export interface SolicitudRevisionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SolicitudRevision'], meta: { name: 'SolicitudRevision' } }
    /**
     * Find zero or one SolicitudRevision that matches the filter.
     * @param {SolicitudRevisionFindUniqueArgs} args - Arguments to find a SolicitudRevision
     * @example
     * // Get one SolicitudRevision
     * const solicitudRevision = await prisma.solicitudRevision.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SolicitudRevisionFindUniqueArgs>(args: SelectSubset<T, SolicitudRevisionFindUniqueArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SolicitudRevision that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SolicitudRevisionFindUniqueOrThrowArgs} args - Arguments to find a SolicitudRevision
     * @example
     * // Get one SolicitudRevision
     * const solicitudRevision = await prisma.solicitudRevision.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SolicitudRevisionFindUniqueOrThrowArgs>(args: SelectSubset<T, SolicitudRevisionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SolicitudRevision that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SolicitudRevisionFindFirstArgs} args - Arguments to find a SolicitudRevision
     * @example
     * // Get one SolicitudRevision
     * const solicitudRevision = await prisma.solicitudRevision.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SolicitudRevisionFindFirstArgs>(args?: SelectSubset<T, SolicitudRevisionFindFirstArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SolicitudRevision that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SolicitudRevisionFindFirstOrThrowArgs} args - Arguments to find a SolicitudRevision
     * @example
     * // Get one SolicitudRevision
     * const solicitudRevision = await prisma.solicitudRevision.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SolicitudRevisionFindFirstOrThrowArgs>(args?: SelectSubset<T, SolicitudRevisionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SolicitudRevisions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SolicitudRevisionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SolicitudRevisions
     * const solicitudRevisions = await prisma.solicitudRevision.findMany()
     * 
     * // Get first 10 SolicitudRevisions
     * const solicitudRevisions = await prisma.solicitudRevision.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const solicitudRevisionWithIdOnly = await prisma.solicitudRevision.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SolicitudRevisionFindManyArgs>(args?: SelectSubset<T, SolicitudRevisionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SolicitudRevision.
     * @param {SolicitudRevisionCreateArgs} args - Arguments to create a SolicitudRevision.
     * @example
     * // Create one SolicitudRevision
     * const SolicitudRevision = await prisma.solicitudRevision.create({
     *   data: {
     *     // ... data to create a SolicitudRevision
     *   }
     * })
     * 
     */
    create<T extends SolicitudRevisionCreateArgs>(args: SelectSubset<T, SolicitudRevisionCreateArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SolicitudRevisions.
     * @param {SolicitudRevisionCreateManyArgs} args - Arguments to create many SolicitudRevisions.
     * @example
     * // Create many SolicitudRevisions
     * const solicitudRevision = await prisma.solicitudRevision.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SolicitudRevisionCreateManyArgs>(args?: SelectSubset<T, SolicitudRevisionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SolicitudRevisions and returns the data saved in the database.
     * @param {SolicitudRevisionCreateManyAndReturnArgs} args - Arguments to create many SolicitudRevisions.
     * @example
     * // Create many SolicitudRevisions
     * const solicitudRevision = await prisma.solicitudRevision.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SolicitudRevisions and only return the `id`
     * const solicitudRevisionWithIdOnly = await prisma.solicitudRevision.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SolicitudRevisionCreateManyAndReturnArgs>(args?: SelectSubset<T, SolicitudRevisionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SolicitudRevision.
     * @param {SolicitudRevisionDeleteArgs} args - Arguments to delete one SolicitudRevision.
     * @example
     * // Delete one SolicitudRevision
     * const SolicitudRevision = await prisma.solicitudRevision.delete({
     *   where: {
     *     // ... filter to delete one SolicitudRevision
     *   }
     * })
     * 
     */
    delete<T extends SolicitudRevisionDeleteArgs>(args: SelectSubset<T, SolicitudRevisionDeleteArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SolicitudRevision.
     * @param {SolicitudRevisionUpdateArgs} args - Arguments to update one SolicitudRevision.
     * @example
     * // Update one SolicitudRevision
     * const solicitudRevision = await prisma.solicitudRevision.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SolicitudRevisionUpdateArgs>(args: SelectSubset<T, SolicitudRevisionUpdateArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SolicitudRevisions.
     * @param {SolicitudRevisionDeleteManyArgs} args - Arguments to filter SolicitudRevisions to delete.
     * @example
     * // Delete a few SolicitudRevisions
     * const { count } = await prisma.solicitudRevision.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SolicitudRevisionDeleteManyArgs>(args?: SelectSubset<T, SolicitudRevisionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SolicitudRevisions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SolicitudRevisionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SolicitudRevisions
     * const solicitudRevision = await prisma.solicitudRevision.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SolicitudRevisionUpdateManyArgs>(args: SelectSubset<T, SolicitudRevisionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SolicitudRevisions and returns the data updated in the database.
     * @param {SolicitudRevisionUpdateManyAndReturnArgs} args - Arguments to update many SolicitudRevisions.
     * @example
     * // Update many SolicitudRevisions
     * const solicitudRevision = await prisma.solicitudRevision.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SolicitudRevisions and only return the `id`
     * const solicitudRevisionWithIdOnly = await prisma.solicitudRevision.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SolicitudRevisionUpdateManyAndReturnArgs>(args: SelectSubset<T, SolicitudRevisionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SolicitudRevision.
     * @param {SolicitudRevisionUpsertArgs} args - Arguments to update or create a SolicitudRevision.
     * @example
     * // Update or create a SolicitudRevision
     * const solicitudRevision = await prisma.solicitudRevision.upsert({
     *   create: {
     *     // ... data to create a SolicitudRevision
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SolicitudRevision we want to update
     *   }
     * })
     */
    upsert<T extends SolicitudRevisionUpsertArgs>(args: SelectSubset<T, SolicitudRevisionUpsertArgs<ExtArgs>>): Prisma__SolicitudRevisionClient<$Result.GetResult<Prisma.$SolicitudRevisionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SolicitudRevisions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SolicitudRevisionCountArgs} args - Arguments to filter SolicitudRevisions to count.
     * @example
     * // Count the number of SolicitudRevisions
     * const count = await prisma.solicitudRevision.count({
     *   where: {
     *     // ... the filter for the SolicitudRevisions we want to count
     *   }
     * })
    **/
    count<T extends SolicitudRevisionCountArgs>(
      args?: Subset<T, SolicitudRevisionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SolicitudRevisionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SolicitudRevision.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SolicitudRevisionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SolicitudRevisionAggregateArgs>(args: Subset<T, SolicitudRevisionAggregateArgs>): Prisma.PrismaPromise<GetSolicitudRevisionAggregateType<T>>

    /**
     * Group by SolicitudRevision.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SolicitudRevisionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SolicitudRevisionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SolicitudRevisionGroupByArgs['orderBy'] }
        : { orderBy?: SolicitudRevisionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SolicitudRevisionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSolicitudRevisionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SolicitudRevision model
   */
  readonly fields: SolicitudRevisionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SolicitudRevision.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SolicitudRevisionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SolicitudRevision model
   */
  interface SolicitudRevisionFieldRefs {
    readonly id: FieldRef<"SolicitudRevision", 'String'>
    readonly externoId: FieldRef<"SolicitudRevision", 'String'>
    readonly periodoId: FieldRef<"SolicitudRevision", 'String'>
    readonly docenteId: FieldRef<"SolicitudRevision", 'String'>
    readonly alumnoId: FieldRef<"SolicitudRevision", 'String'>
    readonly examenGeneradoId: FieldRef<"SolicitudRevision", 'String'>
    readonly folio: FieldRef<"SolicitudRevision", 'String'>
    readonly numeroPregunta: FieldRef<"SolicitudRevision", 'Int'>
    readonly comentario: FieldRef<"SolicitudRevision", 'String'>
    readonly estado: FieldRef<"SolicitudRevision", 'String'>
    readonly solicitadoEn: FieldRef<"SolicitudRevision", 'DateTime'>
    readonly atendidoEn: FieldRef<"SolicitudRevision", 'DateTime'>
    readonly respuestaDocente: FieldRef<"SolicitudRevision", 'String'>
    readonly firmaDocente: FieldRef<"SolicitudRevision", 'String'>
    readonly firmadoEn: FieldRef<"SolicitudRevision", 'DateTime'>
    readonly cerradoEn: FieldRef<"SolicitudRevision", 'DateTime'>
    readonly conformidadAlumno: FieldRef<"SolicitudRevision", 'Boolean'>
    readonly conformidadActualizadaEn: FieldRef<"SolicitudRevision", 'DateTime'>
    readonly origen: FieldRef<"SolicitudRevision", 'String'>
    readonly createdAt: FieldRef<"SolicitudRevision", 'DateTime'>
    readonly updatedAt: FieldRef<"SolicitudRevision", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SolicitudRevision findUnique
   */
  export type SolicitudRevisionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * Filter, which SolicitudRevision to fetch.
     */
    where: SolicitudRevisionWhereUniqueInput
  }

  /**
   * SolicitudRevision findUniqueOrThrow
   */
  export type SolicitudRevisionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * Filter, which SolicitudRevision to fetch.
     */
    where: SolicitudRevisionWhereUniqueInput
  }

  /**
   * SolicitudRevision findFirst
   */
  export type SolicitudRevisionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * Filter, which SolicitudRevision to fetch.
     */
    where?: SolicitudRevisionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SolicitudRevisions to fetch.
     */
    orderBy?: SolicitudRevisionOrderByWithRelationInput | SolicitudRevisionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SolicitudRevisions.
     */
    cursor?: SolicitudRevisionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SolicitudRevisions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SolicitudRevisions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SolicitudRevisions.
     */
    distinct?: SolicitudRevisionScalarFieldEnum | SolicitudRevisionScalarFieldEnum[]
  }

  /**
   * SolicitudRevision findFirstOrThrow
   */
  export type SolicitudRevisionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * Filter, which SolicitudRevision to fetch.
     */
    where?: SolicitudRevisionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SolicitudRevisions to fetch.
     */
    orderBy?: SolicitudRevisionOrderByWithRelationInput | SolicitudRevisionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SolicitudRevisions.
     */
    cursor?: SolicitudRevisionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SolicitudRevisions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SolicitudRevisions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SolicitudRevisions.
     */
    distinct?: SolicitudRevisionScalarFieldEnum | SolicitudRevisionScalarFieldEnum[]
  }

  /**
   * SolicitudRevision findMany
   */
  export type SolicitudRevisionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * Filter, which SolicitudRevisions to fetch.
     */
    where?: SolicitudRevisionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SolicitudRevisions to fetch.
     */
    orderBy?: SolicitudRevisionOrderByWithRelationInput | SolicitudRevisionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SolicitudRevisions.
     */
    cursor?: SolicitudRevisionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SolicitudRevisions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SolicitudRevisions.
     */
    skip?: number
    distinct?: SolicitudRevisionScalarFieldEnum | SolicitudRevisionScalarFieldEnum[]
  }

  /**
   * SolicitudRevision create
   */
  export type SolicitudRevisionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * The data needed to create a SolicitudRevision.
     */
    data: XOR<SolicitudRevisionCreateInput, SolicitudRevisionUncheckedCreateInput>
  }

  /**
   * SolicitudRevision createMany
   */
  export type SolicitudRevisionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SolicitudRevisions.
     */
    data: SolicitudRevisionCreateManyInput | SolicitudRevisionCreateManyInput[]
  }

  /**
   * SolicitudRevision createManyAndReturn
   */
  export type SolicitudRevisionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * The data used to create many SolicitudRevisions.
     */
    data: SolicitudRevisionCreateManyInput | SolicitudRevisionCreateManyInput[]
  }

  /**
   * SolicitudRevision update
   */
  export type SolicitudRevisionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * The data needed to update a SolicitudRevision.
     */
    data: XOR<SolicitudRevisionUpdateInput, SolicitudRevisionUncheckedUpdateInput>
    /**
     * Choose, which SolicitudRevision to update.
     */
    where: SolicitudRevisionWhereUniqueInput
  }

  /**
   * SolicitudRevision updateMany
   */
  export type SolicitudRevisionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SolicitudRevisions.
     */
    data: XOR<SolicitudRevisionUpdateManyMutationInput, SolicitudRevisionUncheckedUpdateManyInput>
    /**
     * Filter which SolicitudRevisions to update
     */
    where?: SolicitudRevisionWhereInput
    /**
     * Limit how many SolicitudRevisions to update.
     */
    limit?: number
  }

  /**
   * SolicitudRevision updateManyAndReturn
   */
  export type SolicitudRevisionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * The data used to update SolicitudRevisions.
     */
    data: XOR<SolicitudRevisionUpdateManyMutationInput, SolicitudRevisionUncheckedUpdateManyInput>
    /**
     * Filter which SolicitudRevisions to update
     */
    where?: SolicitudRevisionWhereInput
    /**
     * Limit how many SolicitudRevisions to update.
     */
    limit?: number
  }

  /**
   * SolicitudRevision upsert
   */
  export type SolicitudRevisionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * The filter to search for the SolicitudRevision to update in case it exists.
     */
    where: SolicitudRevisionWhereUniqueInput
    /**
     * In case the SolicitudRevision found by the `where` argument doesn't exist, create a new SolicitudRevision with this data.
     */
    create: XOR<SolicitudRevisionCreateInput, SolicitudRevisionUncheckedCreateInput>
    /**
     * In case the SolicitudRevision was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SolicitudRevisionUpdateInput, SolicitudRevisionUncheckedUpdateInput>
  }

  /**
   * SolicitudRevision delete
   */
  export type SolicitudRevisionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
    /**
     * Filter which SolicitudRevision to delete.
     */
    where: SolicitudRevisionWhereUniqueInput
  }

  /**
   * SolicitudRevision deleteMany
   */
  export type SolicitudRevisionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SolicitudRevisions to delete
     */
    where?: SolicitudRevisionWhereInput
    /**
     * Limit how many SolicitudRevisions to delete.
     */
    limit?: number
  }

  /**
   * SolicitudRevision without action
   */
  export type SolicitudRevisionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SolicitudRevision
     */
    select?: SolicitudRevisionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SolicitudRevision
     */
    omit?: SolicitudRevisionOmit<ExtArgs> | null
  }


  /**
   * Model PaqueteSyncDocente
   */

  export type AggregatePaqueteSyncDocente = {
    _count: PaqueteSyncDocenteCountAggregateOutputType | null
    _avg: PaqueteSyncDocenteAvgAggregateOutputType | null
    _sum: PaqueteSyncDocenteSumAggregateOutputType | null
    _min: PaqueteSyncDocenteMinAggregateOutputType | null
    _max: PaqueteSyncDocenteMaxAggregateOutputType | null
  }

  export type PaqueteSyncDocenteAvgAggregateOutputType = {
    schemaVersion: number | null
  }

  export type PaqueteSyncDocenteSumAggregateOutputType = {
    schemaVersion: number | null
  }

  export type PaqueteSyncDocenteMinAggregateOutputType = {
    id: string | null
    docenteId: string | null
    paqueteBase64: string | null
    checksumSha256: string | null
    schemaVersion: number | null
    exportadoEn: Date | null
    desde: Date | null
    periodoId: string | null
    conteos: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PaqueteSyncDocenteMaxAggregateOutputType = {
    id: string | null
    docenteId: string | null
    paqueteBase64: string | null
    checksumSha256: string | null
    schemaVersion: number | null
    exportadoEn: Date | null
    desde: Date | null
    periodoId: string | null
    conteos: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PaqueteSyncDocenteCountAggregateOutputType = {
    id: number
    docenteId: number
    paqueteBase64: number
    checksumSha256: number
    schemaVersion: number
    exportadoEn: number
    desde: number
    periodoId: number
    conteos: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PaqueteSyncDocenteAvgAggregateInputType = {
    schemaVersion?: true
  }

  export type PaqueteSyncDocenteSumAggregateInputType = {
    schemaVersion?: true
  }

  export type PaqueteSyncDocenteMinAggregateInputType = {
    id?: true
    docenteId?: true
    paqueteBase64?: true
    checksumSha256?: true
    schemaVersion?: true
    exportadoEn?: true
    desde?: true
    periodoId?: true
    conteos?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PaqueteSyncDocenteMaxAggregateInputType = {
    id?: true
    docenteId?: true
    paqueteBase64?: true
    checksumSha256?: true
    schemaVersion?: true
    exportadoEn?: true
    desde?: true
    periodoId?: true
    conteos?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PaqueteSyncDocenteCountAggregateInputType = {
    id?: true
    docenteId?: true
    paqueteBase64?: true
    checksumSha256?: true
    schemaVersion?: true
    exportadoEn?: true
    desde?: true
    periodoId?: true
    conteos?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PaqueteSyncDocenteAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PaqueteSyncDocente to aggregate.
     */
    where?: PaqueteSyncDocenteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaqueteSyncDocentes to fetch.
     */
    orderBy?: PaqueteSyncDocenteOrderByWithRelationInput | PaqueteSyncDocenteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PaqueteSyncDocenteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaqueteSyncDocentes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaqueteSyncDocentes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PaqueteSyncDocentes
    **/
    _count?: true | PaqueteSyncDocenteCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PaqueteSyncDocenteAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PaqueteSyncDocenteSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PaqueteSyncDocenteMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PaqueteSyncDocenteMaxAggregateInputType
  }

  export type GetPaqueteSyncDocenteAggregateType<T extends PaqueteSyncDocenteAggregateArgs> = {
        [P in keyof T & keyof AggregatePaqueteSyncDocente]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePaqueteSyncDocente[P]>
      : GetScalarType<T[P], AggregatePaqueteSyncDocente[P]>
  }




  export type PaqueteSyncDocenteGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaqueteSyncDocenteWhereInput
    orderBy?: PaqueteSyncDocenteOrderByWithAggregationInput | PaqueteSyncDocenteOrderByWithAggregationInput[]
    by: PaqueteSyncDocenteScalarFieldEnum[] | PaqueteSyncDocenteScalarFieldEnum
    having?: PaqueteSyncDocenteScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PaqueteSyncDocenteCountAggregateInputType | true
    _avg?: PaqueteSyncDocenteAvgAggregateInputType
    _sum?: PaqueteSyncDocenteSumAggregateInputType
    _min?: PaqueteSyncDocenteMinAggregateInputType
    _max?: PaqueteSyncDocenteMaxAggregateInputType
  }

  export type PaqueteSyncDocenteGroupByOutputType = {
    id: string
    docenteId: string
    paqueteBase64: string
    checksumSha256: string | null
    schemaVersion: number
    exportadoEn: Date | null
    desde: Date | null
    periodoId: string | null
    conteos: string | null
    createdAt: Date
    updatedAt: Date
    _count: PaqueteSyncDocenteCountAggregateOutputType | null
    _avg: PaqueteSyncDocenteAvgAggregateOutputType | null
    _sum: PaqueteSyncDocenteSumAggregateOutputType | null
    _min: PaqueteSyncDocenteMinAggregateOutputType | null
    _max: PaqueteSyncDocenteMaxAggregateOutputType | null
  }

  type GetPaqueteSyncDocenteGroupByPayload<T extends PaqueteSyncDocenteGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PaqueteSyncDocenteGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PaqueteSyncDocenteGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PaqueteSyncDocenteGroupByOutputType[P]>
            : GetScalarType<T[P], PaqueteSyncDocenteGroupByOutputType[P]>
        }
      >
    >


  export type PaqueteSyncDocenteSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    docenteId?: boolean
    paqueteBase64?: boolean
    checksumSha256?: boolean
    schemaVersion?: boolean
    exportadoEn?: boolean
    desde?: boolean
    periodoId?: boolean
    conteos?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["paqueteSyncDocente"]>

  export type PaqueteSyncDocenteSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    docenteId?: boolean
    paqueteBase64?: boolean
    checksumSha256?: boolean
    schemaVersion?: boolean
    exportadoEn?: boolean
    desde?: boolean
    periodoId?: boolean
    conteos?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["paqueteSyncDocente"]>

  export type PaqueteSyncDocenteSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    docenteId?: boolean
    paqueteBase64?: boolean
    checksumSha256?: boolean
    schemaVersion?: boolean
    exportadoEn?: boolean
    desde?: boolean
    periodoId?: boolean
    conteos?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["paqueteSyncDocente"]>

  export type PaqueteSyncDocenteSelectScalar = {
    id?: boolean
    docenteId?: boolean
    paqueteBase64?: boolean
    checksumSha256?: boolean
    schemaVersion?: boolean
    exportadoEn?: boolean
    desde?: boolean
    periodoId?: boolean
    conteos?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PaqueteSyncDocenteOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "docenteId" | "paqueteBase64" | "checksumSha256" | "schemaVersion" | "exportadoEn" | "desde" | "periodoId" | "conteos" | "createdAt" | "updatedAt", ExtArgs["result"]["paqueteSyncDocente"]>

  export type $PaqueteSyncDocentePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PaqueteSyncDocente"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      docenteId: string
      paqueteBase64: string
      checksumSha256: string | null
      schemaVersion: number
      exportadoEn: Date | null
      desde: Date | null
      periodoId: string | null
      conteos: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["paqueteSyncDocente"]>
    composites: {}
  }

  type PaqueteSyncDocenteGetPayload<S extends boolean | null | undefined | PaqueteSyncDocenteDefaultArgs> = $Result.GetResult<Prisma.$PaqueteSyncDocentePayload, S>

  type PaqueteSyncDocenteCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PaqueteSyncDocenteFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PaqueteSyncDocenteCountAggregateInputType | true
    }

  export interface PaqueteSyncDocenteDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PaqueteSyncDocente'], meta: { name: 'PaqueteSyncDocente' } }
    /**
     * Find zero or one PaqueteSyncDocente that matches the filter.
     * @param {PaqueteSyncDocenteFindUniqueArgs} args - Arguments to find a PaqueteSyncDocente
     * @example
     * // Get one PaqueteSyncDocente
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PaqueteSyncDocenteFindUniqueArgs>(args: SelectSubset<T, PaqueteSyncDocenteFindUniqueArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PaqueteSyncDocente that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PaqueteSyncDocenteFindUniqueOrThrowArgs} args - Arguments to find a PaqueteSyncDocente
     * @example
     * // Get one PaqueteSyncDocente
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PaqueteSyncDocenteFindUniqueOrThrowArgs>(args: SelectSubset<T, PaqueteSyncDocenteFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PaqueteSyncDocente that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaqueteSyncDocenteFindFirstArgs} args - Arguments to find a PaqueteSyncDocente
     * @example
     * // Get one PaqueteSyncDocente
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PaqueteSyncDocenteFindFirstArgs>(args?: SelectSubset<T, PaqueteSyncDocenteFindFirstArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PaqueteSyncDocente that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaqueteSyncDocenteFindFirstOrThrowArgs} args - Arguments to find a PaqueteSyncDocente
     * @example
     * // Get one PaqueteSyncDocente
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PaqueteSyncDocenteFindFirstOrThrowArgs>(args?: SelectSubset<T, PaqueteSyncDocenteFindFirstOrThrowArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PaqueteSyncDocentes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaqueteSyncDocenteFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PaqueteSyncDocentes
     * const paqueteSyncDocentes = await prisma.paqueteSyncDocente.findMany()
     * 
     * // Get first 10 PaqueteSyncDocentes
     * const paqueteSyncDocentes = await prisma.paqueteSyncDocente.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const paqueteSyncDocenteWithIdOnly = await prisma.paqueteSyncDocente.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PaqueteSyncDocenteFindManyArgs>(args?: SelectSubset<T, PaqueteSyncDocenteFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PaqueteSyncDocente.
     * @param {PaqueteSyncDocenteCreateArgs} args - Arguments to create a PaqueteSyncDocente.
     * @example
     * // Create one PaqueteSyncDocente
     * const PaqueteSyncDocente = await prisma.paqueteSyncDocente.create({
     *   data: {
     *     // ... data to create a PaqueteSyncDocente
     *   }
     * })
     * 
     */
    create<T extends PaqueteSyncDocenteCreateArgs>(args: SelectSubset<T, PaqueteSyncDocenteCreateArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PaqueteSyncDocentes.
     * @param {PaqueteSyncDocenteCreateManyArgs} args - Arguments to create many PaqueteSyncDocentes.
     * @example
     * // Create many PaqueteSyncDocentes
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PaqueteSyncDocenteCreateManyArgs>(args?: SelectSubset<T, PaqueteSyncDocenteCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PaqueteSyncDocentes and returns the data saved in the database.
     * @param {PaqueteSyncDocenteCreateManyAndReturnArgs} args - Arguments to create many PaqueteSyncDocentes.
     * @example
     * // Create many PaqueteSyncDocentes
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PaqueteSyncDocentes and only return the `id`
     * const paqueteSyncDocenteWithIdOnly = await prisma.paqueteSyncDocente.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PaqueteSyncDocenteCreateManyAndReturnArgs>(args?: SelectSubset<T, PaqueteSyncDocenteCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PaqueteSyncDocente.
     * @param {PaqueteSyncDocenteDeleteArgs} args - Arguments to delete one PaqueteSyncDocente.
     * @example
     * // Delete one PaqueteSyncDocente
     * const PaqueteSyncDocente = await prisma.paqueteSyncDocente.delete({
     *   where: {
     *     // ... filter to delete one PaqueteSyncDocente
     *   }
     * })
     * 
     */
    delete<T extends PaqueteSyncDocenteDeleteArgs>(args: SelectSubset<T, PaqueteSyncDocenteDeleteArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PaqueteSyncDocente.
     * @param {PaqueteSyncDocenteUpdateArgs} args - Arguments to update one PaqueteSyncDocente.
     * @example
     * // Update one PaqueteSyncDocente
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PaqueteSyncDocenteUpdateArgs>(args: SelectSubset<T, PaqueteSyncDocenteUpdateArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PaqueteSyncDocentes.
     * @param {PaqueteSyncDocenteDeleteManyArgs} args - Arguments to filter PaqueteSyncDocentes to delete.
     * @example
     * // Delete a few PaqueteSyncDocentes
     * const { count } = await prisma.paqueteSyncDocente.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PaqueteSyncDocenteDeleteManyArgs>(args?: SelectSubset<T, PaqueteSyncDocenteDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PaqueteSyncDocentes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaqueteSyncDocenteUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PaqueteSyncDocentes
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PaqueteSyncDocenteUpdateManyArgs>(args: SelectSubset<T, PaqueteSyncDocenteUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PaqueteSyncDocentes and returns the data updated in the database.
     * @param {PaqueteSyncDocenteUpdateManyAndReturnArgs} args - Arguments to update many PaqueteSyncDocentes.
     * @example
     * // Update many PaqueteSyncDocentes
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PaqueteSyncDocentes and only return the `id`
     * const paqueteSyncDocenteWithIdOnly = await prisma.paqueteSyncDocente.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PaqueteSyncDocenteUpdateManyAndReturnArgs>(args: SelectSubset<T, PaqueteSyncDocenteUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PaqueteSyncDocente.
     * @param {PaqueteSyncDocenteUpsertArgs} args - Arguments to update or create a PaqueteSyncDocente.
     * @example
     * // Update or create a PaqueteSyncDocente
     * const paqueteSyncDocente = await prisma.paqueteSyncDocente.upsert({
     *   create: {
     *     // ... data to create a PaqueteSyncDocente
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PaqueteSyncDocente we want to update
     *   }
     * })
     */
    upsert<T extends PaqueteSyncDocenteUpsertArgs>(args: SelectSubset<T, PaqueteSyncDocenteUpsertArgs<ExtArgs>>): Prisma__PaqueteSyncDocenteClient<$Result.GetResult<Prisma.$PaqueteSyncDocentePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PaqueteSyncDocentes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaqueteSyncDocenteCountArgs} args - Arguments to filter PaqueteSyncDocentes to count.
     * @example
     * // Count the number of PaqueteSyncDocentes
     * const count = await prisma.paqueteSyncDocente.count({
     *   where: {
     *     // ... the filter for the PaqueteSyncDocentes we want to count
     *   }
     * })
    **/
    count<T extends PaqueteSyncDocenteCountArgs>(
      args?: Subset<T, PaqueteSyncDocenteCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PaqueteSyncDocenteCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PaqueteSyncDocente.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaqueteSyncDocenteAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PaqueteSyncDocenteAggregateArgs>(args: Subset<T, PaqueteSyncDocenteAggregateArgs>): Prisma.PrismaPromise<GetPaqueteSyncDocenteAggregateType<T>>

    /**
     * Group by PaqueteSyncDocente.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaqueteSyncDocenteGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PaqueteSyncDocenteGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PaqueteSyncDocenteGroupByArgs['orderBy'] }
        : { orderBy?: PaqueteSyncDocenteGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PaqueteSyncDocenteGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPaqueteSyncDocenteGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PaqueteSyncDocente model
   */
  readonly fields: PaqueteSyncDocenteFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PaqueteSyncDocente.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PaqueteSyncDocenteClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PaqueteSyncDocente model
   */
  interface PaqueteSyncDocenteFieldRefs {
    readonly id: FieldRef<"PaqueteSyncDocente", 'String'>
    readonly docenteId: FieldRef<"PaqueteSyncDocente", 'String'>
    readonly paqueteBase64: FieldRef<"PaqueteSyncDocente", 'String'>
    readonly checksumSha256: FieldRef<"PaqueteSyncDocente", 'String'>
    readonly schemaVersion: FieldRef<"PaqueteSyncDocente", 'Int'>
    readonly exportadoEn: FieldRef<"PaqueteSyncDocente", 'DateTime'>
    readonly desde: FieldRef<"PaqueteSyncDocente", 'DateTime'>
    readonly periodoId: FieldRef<"PaqueteSyncDocente", 'String'>
    readonly conteos: FieldRef<"PaqueteSyncDocente", 'String'>
    readonly createdAt: FieldRef<"PaqueteSyncDocente", 'DateTime'>
    readonly updatedAt: FieldRef<"PaqueteSyncDocente", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PaqueteSyncDocente findUnique
   */
  export type PaqueteSyncDocenteFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * Filter, which PaqueteSyncDocente to fetch.
     */
    where: PaqueteSyncDocenteWhereUniqueInput
  }

  /**
   * PaqueteSyncDocente findUniqueOrThrow
   */
  export type PaqueteSyncDocenteFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * Filter, which PaqueteSyncDocente to fetch.
     */
    where: PaqueteSyncDocenteWhereUniqueInput
  }

  /**
   * PaqueteSyncDocente findFirst
   */
  export type PaqueteSyncDocenteFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * Filter, which PaqueteSyncDocente to fetch.
     */
    where?: PaqueteSyncDocenteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaqueteSyncDocentes to fetch.
     */
    orderBy?: PaqueteSyncDocenteOrderByWithRelationInput | PaqueteSyncDocenteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PaqueteSyncDocentes.
     */
    cursor?: PaqueteSyncDocenteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaqueteSyncDocentes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaqueteSyncDocentes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PaqueteSyncDocentes.
     */
    distinct?: PaqueteSyncDocenteScalarFieldEnum | PaqueteSyncDocenteScalarFieldEnum[]
  }

  /**
   * PaqueteSyncDocente findFirstOrThrow
   */
  export type PaqueteSyncDocenteFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * Filter, which PaqueteSyncDocente to fetch.
     */
    where?: PaqueteSyncDocenteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaqueteSyncDocentes to fetch.
     */
    orderBy?: PaqueteSyncDocenteOrderByWithRelationInput | PaqueteSyncDocenteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PaqueteSyncDocentes.
     */
    cursor?: PaqueteSyncDocenteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaqueteSyncDocentes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaqueteSyncDocentes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PaqueteSyncDocentes.
     */
    distinct?: PaqueteSyncDocenteScalarFieldEnum | PaqueteSyncDocenteScalarFieldEnum[]
  }

  /**
   * PaqueteSyncDocente findMany
   */
  export type PaqueteSyncDocenteFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * Filter, which PaqueteSyncDocentes to fetch.
     */
    where?: PaqueteSyncDocenteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaqueteSyncDocentes to fetch.
     */
    orderBy?: PaqueteSyncDocenteOrderByWithRelationInput | PaqueteSyncDocenteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PaqueteSyncDocentes.
     */
    cursor?: PaqueteSyncDocenteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaqueteSyncDocentes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaqueteSyncDocentes.
     */
    skip?: number
    distinct?: PaqueteSyncDocenteScalarFieldEnum | PaqueteSyncDocenteScalarFieldEnum[]
  }

  /**
   * PaqueteSyncDocente create
   */
  export type PaqueteSyncDocenteCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * The data needed to create a PaqueteSyncDocente.
     */
    data: XOR<PaqueteSyncDocenteCreateInput, PaqueteSyncDocenteUncheckedCreateInput>
  }

  /**
   * PaqueteSyncDocente createMany
   */
  export type PaqueteSyncDocenteCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PaqueteSyncDocentes.
     */
    data: PaqueteSyncDocenteCreateManyInput | PaqueteSyncDocenteCreateManyInput[]
  }

  /**
   * PaqueteSyncDocente createManyAndReturn
   */
  export type PaqueteSyncDocenteCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * The data used to create many PaqueteSyncDocentes.
     */
    data: PaqueteSyncDocenteCreateManyInput | PaqueteSyncDocenteCreateManyInput[]
  }

  /**
   * PaqueteSyncDocente update
   */
  export type PaqueteSyncDocenteUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * The data needed to update a PaqueteSyncDocente.
     */
    data: XOR<PaqueteSyncDocenteUpdateInput, PaqueteSyncDocenteUncheckedUpdateInput>
    /**
     * Choose, which PaqueteSyncDocente to update.
     */
    where: PaqueteSyncDocenteWhereUniqueInput
  }

  /**
   * PaqueteSyncDocente updateMany
   */
  export type PaqueteSyncDocenteUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PaqueteSyncDocentes.
     */
    data: XOR<PaqueteSyncDocenteUpdateManyMutationInput, PaqueteSyncDocenteUncheckedUpdateManyInput>
    /**
     * Filter which PaqueteSyncDocentes to update
     */
    where?: PaqueteSyncDocenteWhereInput
    /**
     * Limit how many PaqueteSyncDocentes to update.
     */
    limit?: number
  }

  /**
   * PaqueteSyncDocente updateManyAndReturn
   */
  export type PaqueteSyncDocenteUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * The data used to update PaqueteSyncDocentes.
     */
    data: XOR<PaqueteSyncDocenteUpdateManyMutationInput, PaqueteSyncDocenteUncheckedUpdateManyInput>
    /**
     * Filter which PaqueteSyncDocentes to update
     */
    where?: PaqueteSyncDocenteWhereInput
    /**
     * Limit how many PaqueteSyncDocentes to update.
     */
    limit?: number
  }

  /**
   * PaqueteSyncDocente upsert
   */
  export type PaqueteSyncDocenteUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * The filter to search for the PaqueteSyncDocente to update in case it exists.
     */
    where: PaqueteSyncDocenteWhereUniqueInput
    /**
     * In case the PaqueteSyncDocente found by the `where` argument doesn't exist, create a new PaqueteSyncDocente with this data.
     */
    create: XOR<PaqueteSyncDocenteCreateInput, PaqueteSyncDocenteUncheckedCreateInput>
    /**
     * In case the PaqueteSyncDocente was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PaqueteSyncDocenteUpdateInput, PaqueteSyncDocenteUncheckedUpdateInput>
  }

  /**
   * PaqueteSyncDocente delete
   */
  export type PaqueteSyncDocenteDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
    /**
     * Filter which PaqueteSyncDocente to delete.
     */
    where: PaqueteSyncDocenteWhereUniqueInput
  }

  /**
   * PaqueteSyncDocente deleteMany
   */
  export type PaqueteSyncDocenteDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PaqueteSyncDocentes to delete
     */
    where?: PaqueteSyncDocenteWhereInput
    /**
     * Limit how many PaqueteSyncDocentes to delete.
     */
    limit?: number
  }

  /**
   * PaqueteSyncDocente without action
   */
  export type PaqueteSyncDocenteDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaqueteSyncDocente
     */
    select?: PaqueteSyncDocenteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaqueteSyncDocente
     */
    omit?: PaqueteSyncDocenteOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const PerfilAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    alumnoId: 'alumnoId',
    matricula: 'matricula',
    nombreCompleto: 'nombreCompleto',
    grupo: 'grupo',
    docenteId: 'docenteId',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PerfilAlumnoScalarFieldEnum = (typeof PerfilAlumnoScalarFieldEnum)[keyof typeof PerfilAlumnoScalarFieldEnum]


  export const ResultadoAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    docenteId: 'docenteId',
    alumnoId: 'alumnoId',
    examenGeneradoId: 'examenGeneradoId',
    matricula: 'matricula',
    nombreCompleto: 'nombreCompleto',
    grupo: 'grupo',
    folio: 'folio',
    tipoExamen: 'tipoExamen',
    totalReactivos: 'totalReactivos',
    aciertos: 'aciertos',
    calificacionExamenFinalTexto: 'calificacionExamenFinalTexto',
    calificacionParcialTexto: 'calificacionParcialTexto',
    calificacionGlobalTexto: 'calificacionGlobalTexto',
    evaluacionContinuaTexto: 'evaluacionContinuaTexto',
    proyectoTexto: 'proyectoTexto',
    politicaId: 'politicaId',
    versionPolitica: 'versionPolitica',
    componentesExamen: 'componentesExamen',
    bloqueContinuaDecimal: 'bloqueContinuaDecimal',
    bloqueExamenesDecimal: 'bloqueExamenesDecimal',
    finalDecimal: 'finalDecimal',
    finalRedondeada: 'finalRedondeada',
    respuestasDetectadas: 'respuestasDetectadas',
    comparativaRespuestas: 'comparativaRespuestas',
    omrCapturas: 'omrCapturas',
    omrAuditoria: 'omrAuditoria',
    banderas: 'banderas',
    pdfComprimidoBase64: 'pdfComprimidoBase64',
    publicadoEn: 'publicadoEn',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ResultadoAlumnoScalarFieldEnum = (typeof ResultadoAlumnoScalarFieldEnum)[keyof typeof ResultadoAlumnoScalarFieldEnum]


  export const MateriaAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    alumnoId: 'alumnoId',
    materiaId: 'materiaId',
    nombre: 'nombre',
    docente: 'docente',
    estado: 'estado',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MateriaAlumnoScalarFieldEnum = (typeof MateriaAlumnoScalarFieldEnum)[keyof typeof MateriaAlumnoScalarFieldEnum]


  export const AgendaAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    alumnoId: 'alumnoId',
    agendaId: 'agendaId',
    titulo: 'titulo',
    descripcion: 'descripcion',
    fecha: 'fecha',
    tipo: 'tipo',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AgendaAlumnoScalarFieldEnum = (typeof AgendaAlumnoScalarFieldEnum)[keyof typeof AgendaAlumnoScalarFieldEnum]


  export const AvisoAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    alumnoId: 'alumnoId',
    avisoId: 'avisoId',
    titulo: 'titulo',
    mensaje: 'mensaje',
    severidad: 'severidad',
    publicadoEn: 'publicadoEn',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AvisoAlumnoScalarFieldEnum = (typeof AvisoAlumnoScalarFieldEnum)[keyof typeof AvisoAlumnoScalarFieldEnum]


  export const HistorialAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    alumnoId: 'alumnoId',
    historialId: 'historialId',
    folio: 'folio',
    tipoExamen: 'tipoExamen',
    calificacionTexto: 'calificacionTexto',
    aciertos: 'aciertos',
    totalReactivos: 'totalReactivos',
    fecha: 'fecha',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type HistorialAlumnoScalarFieldEnum = (typeof HistorialAlumnoScalarFieldEnum)[keyof typeof HistorialAlumnoScalarFieldEnum]


  export const CodigoAccesoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    codigo: 'codigo',
    expiraEn: 'expiraEn',
    usado: 'usado',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CodigoAccesoScalarFieldEnum = (typeof CodigoAccesoScalarFieldEnum)[keyof typeof CodigoAccesoScalarFieldEnum]


  export const EventoUsoAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    alumnoId: 'alumnoId',
    sessionId: 'sessionId',
    pantalla: 'pantalla',
    accion: 'accion',
    exito: 'exito',
    duracionMs: 'duracionMs',
    meta: 'meta',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type EventoUsoAlumnoScalarFieldEnum = (typeof EventoUsoAlumnoScalarFieldEnum)[keyof typeof EventoUsoAlumnoScalarFieldEnum]


  export const SesionAlumnoScalarFieldEnum: {
    id: 'id',
    periodoId: 'periodoId',
    alumnoId: 'alumnoId',
    tokenHash: 'tokenHash',
    expiraEn: 'expiraEn',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SesionAlumnoScalarFieldEnum = (typeof SesionAlumnoScalarFieldEnum)[keyof typeof SesionAlumnoScalarFieldEnum]


  export const SolicitudRevisionScalarFieldEnum: {
    id: 'id',
    externoId: 'externoId',
    periodoId: 'periodoId',
    docenteId: 'docenteId',
    alumnoId: 'alumnoId',
    examenGeneradoId: 'examenGeneradoId',
    folio: 'folio',
    numeroPregunta: 'numeroPregunta',
    comentario: 'comentario',
    estado: 'estado',
    solicitadoEn: 'solicitadoEn',
    atendidoEn: 'atendidoEn',
    respuestaDocente: 'respuestaDocente',
    firmaDocente: 'firmaDocente',
    firmadoEn: 'firmadoEn',
    cerradoEn: 'cerradoEn',
    conformidadAlumno: 'conformidadAlumno',
    conformidadActualizadaEn: 'conformidadActualizadaEn',
    origen: 'origen',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SolicitudRevisionScalarFieldEnum = (typeof SolicitudRevisionScalarFieldEnum)[keyof typeof SolicitudRevisionScalarFieldEnum]


  export const PaqueteSyncDocenteScalarFieldEnum: {
    id: 'id',
    docenteId: 'docenteId',
    paqueteBase64: 'paqueteBase64',
    checksumSha256: 'checksumSha256',
    schemaVersion: 'schemaVersion',
    exportadoEn: 'exportadoEn',
    desde: 'desde',
    periodoId: 'periodoId',
    conteos: 'conteos',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PaqueteSyncDocenteScalarFieldEnum = (typeof PaqueteSyncDocenteScalarFieldEnum)[keyof typeof PaqueteSyncDocenteScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    
  /**
   * Deep Input Types
   */


  export type PerfilAlumnoWhereInput = {
    AND?: PerfilAlumnoWhereInput | PerfilAlumnoWhereInput[]
    OR?: PerfilAlumnoWhereInput[]
    NOT?: PerfilAlumnoWhereInput | PerfilAlumnoWhereInput[]
    id?: StringFilter<"PerfilAlumno"> | string
    periodoId?: StringFilter<"PerfilAlumno"> | string
    alumnoId?: StringFilter<"PerfilAlumno"> | string
    matricula?: StringFilter<"PerfilAlumno"> | string
    nombreCompleto?: StringFilter<"PerfilAlumno"> | string
    grupo?: StringNullableFilter<"PerfilAlumno"> | string | null
    docenteId?: StringNullableFilter<"PerfilAlumno"> | string | null
    metadata?: StringNullableFilter<"PerfilAlumno"> | string | null
    createdAt?: DateTimeFilter<"PerfilAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"PerfilAlumno"> | Date | string
  }

  export type PerfilAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrderInput | SortOrder
    docenteId?: SortOrderInput | SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PerfilAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    periodoId_alumnoId?: PerfilAlumnoPeriodoIdAlumnoIdCompoundUniqueInput
    AND?: PerfilAlumnoWhereInput | PerfilAlumnoWhereInput[]
    OR?: PerfilAlumnoWhereInput[]
    NOT?: PerfilAlumnoWhereInput | PerfilAlumnoWhereInput[]
    periodoId?: StringFilter<"PerfilAlumno"> | string
    alumnoId?: StringFilter<"PerfilAlumno"> | string
    matricula?: StringFilter<"PerfilAlumno"> | string
    nombreCompleto?: StringFilter<"PerfilAlumno"> | string
    grupo?: StringNullableFilter<"PerfilAlumno"> | string | null
    docenteId?: StringNullableFilter<"PerfilAlumno"> | string | null
    metadata?: StringNullableFilter<"PerfilAlumno"> | string | null
    createdAt?: DateTimeFilter<"PerfilAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"PerfilAlumno"> | Date | string
  }, "id" | "periodoId_alumnoId">

  export type PerfilAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrderInput | SortOrder
    docenteId?: SortOrderInput | SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PerfilAlumnoCountOrderByAggregateInput
    _max?: PerfilAlumnoMaxOrderByAggregateInput
    _min?: PerfilAlumnoMinOrderByAggregateInput
  }

  export type PerfilAlumnoScalarWhereWithAggregatesInput = {
    AND?: PerfilAlumnoScalarWhereWithAggregatesInput | PerfilAlumnoScalarWhereWithAggregatesInput[]
    OR?: PerfilAlumnoScalarWhereWithAggregatesInput[]
    NOT?: PerfilAlumnoScalarWhereWithAggregatesInput | PerfilAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PerfilAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"PerfilAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"PerfilAlumno"> | string
    matricula?: StringWithAggregatesFilter<"PerfilAlumno"> | string
    nombreCompleto?: StringWithAggregatesFilter<"PerfilAlumno"> | string
    grupo?: StringNullableWithAggregatesFilter<"PerfilAlumno"> | string | null
    docenteId?: StringNullableWithAggregatesFilter<"PerfilAlumno"> | string | null
    metadata?: StringNullableWithAggregatesFilter<"PerfilAlumno"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PerfilAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PerfilAlumno"> | Date | string
  }

  export type ResultadoAlumnoWhereInput = {
    AND?: ResultadoAlumnoWhereInput | ResultadoAlumnoWhereInput[]
    OR?: ResultadoAlumnoWhereInput[]
    NOT?: ResultadoAlumnoWhereInput | ResultadoAlumnoWhereInput[]
    id?: StringFilter<"ResultadoAlumno"> | string
    periodoId?: StringFilter<"ResultadoAlumno"> | string
    docenteId?: StringFilter<"ResultadoAlumno"> | string
    alumnoId?: StringFilter<"ResultadoAlumno"> | string
    examenGeneradoId?: StringNullableFilter<"ResultadoAlumno"> | string | null
    matricula?: StringFilter<"ResultadoAlumno"> | string
    nombreCompleto?: StringFilter<"ResultadoAlumno"> | string
    grupo?: StringNullableFilter<"ResultadoAlumno"> | string | null
    folio?: StringFilter<"ResultadoAlumno"> | string
    tipoExamen?: StringFilter<"ResultadoAlumno"> | string
    totalReactivos?: IntNullableFilter<"ResultadoAlumno"> | number | null
    aciertos?: IntNullableFilter<"ResultadoAlumno"> | number | null
    calificacionExamenFinalTexto?: StringFilter<"ResultadoAlumno"> | string
    calificacionParcialTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    calificacionGlobalTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    evaluacionContinuaTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    proyectoTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    politicaId?: StringNullableFilter<"ResultadoAlumno"> | string | null
    versionPolitica?: IntNullableFilter<"ResultadoAlumno"> | number | null
    componentesExamen?: StringNullableFilter<"ResultadoAlumno"> | string | null
    bloqueContinuaDecimal?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    bloqueExamenesDecimal?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    finalDecimal?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    finalRedondeada?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    respuestasDetectadas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    comparativaRespuestas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    omrCapturas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    omrAuditoria?: StringNullableFilter<"ResultadoAlumno"> | string | null
    banderas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    pdfComprimidoBase64?: StringNullableFilter<"ResultadoAlumno"> | string | null
    publicadoEn?: DateTimeFilter<"ResultadoAlumno"> | Date | string
    createdAt?: DateTimeFilter<"ResultadoAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"ResultadoAlumno"> | Date | string
  }

  export type ResultadoAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrderInput | SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrderInput | SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    totalReactivos?: SortOrderInput | SortOrder
    aciertos?: SortOrderInput | SortOrder
    calificacionExamenFinalTexto?: SortOrder
    calificacionParcialTexto?: SortOrderInput | SortOrder
    calificacionGlobalTexto?: SortOrderInput | SortOrder
    evaluacionContinuaTexto?: SortOrderInput | SortOrder
    proyectoTexto?: SortOrderInput | SortOrder
    politicaId?: SortOrderInput | SortOrder
    versionPolitica?: SortOrderInput | SortOrder
    componentesExamen?: SortOrderInput | SortOrder
    bloqueContinuaDecimal?: SortOrderInput | SortOrder
    bloqueExamenesDecimal?: SortOrderInput | SortOrder
    finalDecimal?: SortOrderInput | SortOrder
    finalRedondeada?: SortOrderInput | SortOrder
    respuestasDetectadas?: SortOrderInput | SortOrder
    comparativaRespuestas?: SortOrderInput | SortOrder
    omrCapturas?: SortOrderInput | SortOrder
    omrAuditoria?: SortOrderInput | SortOrder
    banderas?: SortOrderInput | SortOrder
    pdfComprimidoBase64?: SortOrderInput | SortOrder
    publicadoEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ResultadoAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    folio?: string
    AND?: ResultadoAlumnoWhereInput | ResultadoAlumnoWhereInput[]
    OR?: ResultadoAlumnoWhereInput[]
    NOT?: ResultadoAlumnoWhereInput | ResultadoAlumnoWhereInput[]
    periodoId?: StringFilter<"ResultadoAlumno"> | string
    docenteId?: StringFilter<"ResultadoAlumno"> | string
    alumnoId?: StringFilter<"ResultadoAlumno"> | string
    examenGeneradoId?: StringNullableFilter<"ResultadoAlumno"> | string | null
    matricula?: StringFilter<"ResultadoAlumno"> | string
    nombreCompleto?: StringFilter<"ResultadoAlumno"> | string
    grupo?: StringNullableFilter<"ResultadoAlumno"> | string | null
    tipoExamen?: StringFilter<"ResultadoAlumno"> | string
    totalReactivos?: IntNullableFilter<"ResultadoAlumno"> | number | null
    aciertos?: IntNullableFilter<"ResultadoAlumno"> | number | null
    calificacionExamenFinalTexto?: StringFilter<"ResultadoAlumno"> | string
    calificacionParcialTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    calificacionGlobalTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    evaluacionContinuaTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    proyectoTexto?: StringNullableFilter<"ResultadoAlumno"> | string | null
    politicaId?: StringNullableFilter<"ResultadoAlumno"> | string | null
    versionPolitica?: IntNullableFilter<"ResultadoAlumno"> | number | null
    componentesExamen?: StringNullableFilter<"ResultadoAlumno"> | string | null
    bloqueContinuaDecimal?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    bloqueExamenesDecimal?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    finalDecimal?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    finalRedondeada?: FloatNullableFilter<"ResultadoAlumno"> | number | null
    respuestasDetectadas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    comparativaRespuestas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    omrCapturas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    omrAuditoria?: StringNullableFilter<"ResultadoAlumno"> | string | null
    banderas?: StringNullableFilter<"ResultadoAlumno"> | string | null
    pdfComprimidoBase64?: StringNullableFilter<"ResultadoAlumno"> | string | null
    publicadoEn?: DateTimeFilter<"ResultadoAlumno"> | Date | string
    createdAt?: DateTimeFilter<"ResultadoAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"ResultadoAlumno"> | Date | string
  }, "id" | "folio">

  export type ResultadoAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrderInput | SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrderInput | SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    totalReactivos?: SortOrderInput | SortOrder
    aciertos?: SortOrderInput | SortOrder
    calificacionExamenFinalTexto?: SortOrder
    calificacionParcialTexto?: SortOrderInput | SortOrder
    calificacionGlobalTexto?: SortOrderInput | SortOrder
    evaluacionContinuaTexto?: SortOrderInput | SortOrder
    proyectoTexto?: SortOrderInput | SortOrder
    politicaId?: SortOrderInput | SortOrder
    versionPolitica?: SortOrderInput | SortOrder
    componentesExamen?: SortOrderInput | SortOrder
    bloqueContinuaDecimal?: SortOrderInput | SortOrder
    bloqueExamenesDecimal?: SortOrderInput | SortOrder
    finalDecimal?: SortOrderInput | SortOrder
    finalRedondeada?: SortOrderInput | SortOrder
    respuestasDetectadas?: SortOrderInput | SortOrder
    comparativaRespuestas?: SortOrderInput | SortOrder
    omrCapturas?: SortOrderInput | SortOrder
    omrAuditoria?: SortOrderInput | SortOrder
    banderas?: SortOrderInput | SortOrder
    pdfComprimidoBase64?: SortOrderInput | SortOrder
    publicadoEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ResultadoAlumnoCountOrderByAggregateInput
    _avg?: ResultadoAlumnoAvgOrderByAggregateInput
    _max?: ResultadoAlumnoMaxOrderByAggregateInput
    _min?: ResultadoAlumnoMinOrderByAggregateInput
    _sum?: ResultadoAlumnoSumOrderByAggregateInput
  }

  export type ResultadoAlumnoScalarWhereWithAggregatesInput = {
    AND?: ResultadoAlumnoScalarWhereWithAggregatesInput | ResultadoAlumnoScalarWhereWithAggregatesInput[]
    OR?: ResultadoAlumnoScalarWhereWithAggregatesInput[]
    NOT?: ResultadoAlumnoScalarWhereWithAggregatesInput | ResultadoAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    docenteId?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    examenGeneradoId?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    matricula?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    nombreCompleto?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    grupo?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    folio?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    tipoExamen?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    totalReactivos?: IntNullableWithAggregatesFilter<"ResultadoAlumno"> | number | null
    aciertos?: IntNullableWithAggregatesFilter<"ResultadoAlumno"> | number | null
    calificacionExamenFinalTexto?: StringWithAggregatesFilter<"ResultadoAlumno"> | string
    calificacionParcialTexto?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    calificacionGlobalTexto?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    evaluacionContinuaTexto?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    proyectoTexto?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    politicaId?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    versionPolitica?: IntNullableWithAggregatesFilter<"ResultadoAlumno"> | number | null
    componentesExamen?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    bloqueContinuaDecimal?: FloatNullableWithAggregatesFilter<"ResultadoAlumno"> | number | null
    bloqueExamenesDecimal?: FloatNullableWithAggregatesFilter<"ResultadoAlumno"> | number | null
    finalDecimal?: FloatNullableWithAggregatesFilter<"ResultadoAlumno"> | number | null
    finalRedondeada?: FloatNullableWithAggregatesFilter<"ResultadoAlumno"> | number | null
    respuestasDetectadas?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    comparativaRespuestas?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    omrCapturas?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    omrAuditoria?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    banderas?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    pdfComprimidoBase64?: StringNullableWithAggregatesFilter<"ResultadoAlumno"> | string | null
    publicadoEn?: DateTimeWithAggregatesFilter<"ResultadoAlumno"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"ResultadoAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ResultadoAlumno"> | Date | string
  }

  export type MateriaAlumnoWhereInput = {
    AND?: MateriaAlumnoWhereInput | MateriaAlumnoWhereInput[]
    OR?: MateriaAlumnoWhereInput[]
    NOT?: MateriaAlumnoWhereInput | MateriaAlumnoWhereInput[]
    id?: StringFilter<"MateriaAlumno"> | string
    periodoId?: StringFilter<"MateriaAlumno"> | string
    alumnoId?: StringFilter<"MateriaAlumno"> | string
    materiaId?: StringFilter<"MateriaAlumno"> | string
    nombre?: StringFilter<"MateriaAlumno"> | string
    docente?: StringNullableFilter<"MateriaAlumno"> | string | null
    estado?: StringFilter<"MateriaAlumno"> | string
    metadata?: StringNullableFilter<"MateriaAlumno"> | string | null
    createdAt?: DateTimeFilter<"MateriaAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"MateriaAlumno"> | Date | string
  }

  export type MateriaAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    materiaId?: SortOrder
    nombre?: SortOrder
    docente?: SortOrderInput | SortOrder
    estado?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MateriaAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    periodoId_alumnoId_materiaId?: MateriaAlumnoPeriodoIdAlumnoIdMateriaIdCompoundUniqueInput
    AND?: MateriaAlumnoWhereInput | MateriaAlumnoWhereInput[]
    OR?: MateriaAlumnoWhereInput[]
    NOT?: MateriaAlumnoWhereInput | MateriaAlumnoWhereInput[]
    periodoId?: StringFilter<"MateriaAlumno"> | string
    alumnoId?: StringFilter<"MateriaAlumno"> | string
    materiaId?: StringFilter<"MateriaAlumno"> | string
    nombre?: StringFilter<"MateriaAlumno"> | string
    docente?: StringNullableFilter<"MateriaAlumno"> | string | null
    estado?: StringFilter<"MateriaAlumno"> | string
    metadata?: StringNullableFilter<"MateriaAlumno"> | string | null
    createdAt?: DateTimeFilter<"MateriaAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"MateriaAlumno"> | Date | string
  }, "id" | "periodoId_alumnoId_materiaId">

  export type MateriaAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    materiaId?: SortOrder
    nombre?: SortOrder
    docente?: SortOrderInput | SortOrder
    estado?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MateriaAlumnoCountOrderByAggregateInput
    _max?: MateriaAlumnoMaxOrderByAggregateInput
    _min?: MateriaAlumnoMinOrderByAggregateInput
  }

  export type MateriaAlumnoScalarWhereWithAggregatesInput = {
    AND?: MateriaAlumnoScalarWhereWithAggregatesInput | MateriaAlumnoScalarWhereWithAggregatesInput[]
    OR?: MateriaAlumnoScalarWhereWithAggregatesInput[]
    NOT?: MateriaAlumnoScalarWhereWithAggregatesInput | MateriaAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MateriaAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"MateriaAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"MateriaAlumno"> | string
    materiaId?: StringWithAggregatesFilter<"MateriaAlumno"> | string
    nombre?: StringWithAggregatesFilter<"MateriaAlumno"> | string
    docente?: StringNullableWithAggregatesFilter<"MateriaAlumno"> | string | null
    estado?: StringWithAggregatesFilter<"MateriaAlumno"> | string
    metadata?: StringNullableWithAggregatesFilter<"MateriaAlumno"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"MateriaAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MateriaAlumno"> | Date | string
  }

  export type AgendaAlumnoWhereInput = {
    AND?: AgendaAlumnoWhereInput | AgendaAlumnoWhereInput[]
    OR?: AgendaAlumnoWhereInput[]
    NOT?: AgendaAlumnoWhereInput | AgendaAlumnoWhereInput[]
    id?: StringFilter<"AgendaAlumno"> | string
    periodoId?: StringFilter<"AgendaAlumno"> | string
    alumnoId?: StringFilter<"AgendaAlumno"> | string
    agendaId?: StringFilter<"AgendaAlumno"> | string
    titulo?: StringFilter<"AgendaAlumno"> | string
    descripcion?: StringNullableFilter<"AgendaAlumno"> | string | null
    fecha?: DateTimeFilter<"AgendaAlumno"> | Date | string
    tipo?: StringFilter<"AgendaAlumno"> | string
    metadata?: StringNullableFilter<"AgendaAlumno"> | string | null
    createdAt?: DateTimeFilter<"AgendaAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"AgendaAlumno"> | Date | string
  }

  export type AgendaAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    agendaId?: SortOrder
    titulo?: SortOrder
    descripcion?: SortOrderInput | SortOrder
    fecha?: SortOrder
    tipo?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AgendaAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    periodoId_alumnoId_agendaId?: AgendaAlumnoPeriodoIdAlumnoIdAgendaIdCompoundUniqueInput
    AND?: AgendaAlumnoWhereInput | AgendaAlumnoWhereInput[]
    OR?: AgendaAlumnoWhereInput[]
    NOT?: AgendaAlumnoWhereInput | AgendaAlumnoWhereInput[]
    periodoId?: StringFilter<"AgendaAlumno"> | string
    alumnoId?: StringFilter<"AgendaAlumno"> | string
    agendaId?: StringFilter<"AgendaAlumno"> | string
    titulo?: StringFilter<"AgendaAlumno"> | string
    descripcion?: StringNullableFilter<"AgendaAlumno"> | string | null
    fecha?: DateTimeFilter<"AgendaAlumno"> | Date | string
    tipo?: StringFilter<"AgendaAlumno"> | string
    metadata?: StringNullableFilter<"AgendaAlumno"> | string | null
    createdAt?: DateTimeFilter<"AgendaAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"AgendaAlumno"> | Date | string
  }, "id" | "periodoId_alumnoId_agendaId">

  export type AgendaAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    agendaId?: SortOrder
    titulo?: SortOrder
    descripcion?: SortOrderInput | SortOrder
    fecha?: SortOrder
    tipo?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AgendaAlumnoCountOrderByAggregateInput
    _max?: AgendaAlumnoMaxOrderByAggregateInput
    _min?: AgendaAlumnoMinOrderByAggregateInput
  }

  export type AgendaAlumnoScalarWhereWithAggregatesInput = {
    AND?: AgendaAlumnoScalarWhereWithAggregatesInput | AgendaAlumnoScalarWhereWithAggregatesInput[]
    OR?: AgendaAlumnoScalarWhereWithAggregatesInput[]
    NOT?: AgendaAlumnoScalarWhereWithAggregatesInput | AgendaAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AgendaAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"AgendaAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"AgendaAlumno"> | string
    agendaId?: StringWithAggregatesFilter<"AgendaAlumno"> | string
    titulo?: StringWithAggregatesFilter<"AgendaAlumno"> | string
    descripcion?: StringNullableWithAggregatesFilter<"AgendaAlumno"> | string | null
    fecha?: DateTimeWithAggregatesFilter<"AgendaAlumno"> | Date | string
    tipo?: StringWithAggregatesFilter<"AgendaAlumno"> | string
    metadata?: StringNullableWithAggregatesFilter<"AgendaAlumno"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"AgendaAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AgendaAlumno"> | Date | string
  }

  export type AvisoAlumnoWhereInput = {
    AND?: AvisoAlumnoWhereInput | AvisoAlumnoWhereInput[]
    OR?: AvisoAlumnoWhereInput[]
    NOT?: AvisoAlumnoWhereInput | AvisoAlumnoWhereInput[]
    id?: StringFilter<"AvisoAlumno"> | string
    periodoId?: StringFilter<"AvisoAlumno"> | string
    alumnoId?: StringFilter<"AvisoAlumno"> | string
    avisoId?: StringFilter<"AvisoAlumno"> | string
    titulo?: StringFilter<"AvisoAlumno"> | string
    mensaje?: StringFilter<"AvisoAlumno"> | string
    severidad?: StringFilter<"AvisoAlumno"> | string
    publicadoEn?: DateTimeFilter<"AvisoAlumno"> | Date | string
    metadata?: StringNullableFilter<"AvisoAlumno"> | string | null
    createdAt?: DateTimeFilter<"AvisoAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"AvisoAlumno"> | Date | string
  }

  export type AvisoAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    avisoId?: SortOrder
    titulo?: SortOrder
    mensaje?: SortOrder
    severidad?: SortOrder
    publicadoEn?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AvisoAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    periodoId_alumnoId_avisoId?: AvisoAlumnoPeriodoIdAlumnoIdAvisoIdCompoundUniqueInput
    AND?: AvisoAlumnoWhereInput | AvisoAlumnoWhereInput[]
    OR?: AvisoAlumnoWhereInput[]
    NOT?: AvisoAlumnoWhereInput | AvisoAlumnoWhereInput[]
    periodoId?: StringFilter<"AvisoAlumno"> | string
    alumnoId?: StringFilter<"AvisoAlumno"> | string
    avisoId?: StringFilter<"AvisoAlumno"> | string
    titulo?: StringFilter<"AvisoAlumno"> | string
    mensaje?: StringFilter<"AvisoAlumno"> | string
    severidad?: StringFilter<"AvisoAlumno"> | string
    publicadoEn?: DateTimeFilter<"AvisoAlumno"> | Date | string
    metadata?: StringNullableFilter<"AvisoAlumno"> | string | null
    createdAt?: DateTimeFilter<"AvisoAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"AvisoAlumno"> | Date | string
  }, "id" | "periodoId_alumnoId_avisoId">

  export type AvisoAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    avisoId?: SortOrder
    titulo?: SortOrder
    mensaje?: SortOrder
    severidad?: SortOrder
    publicadoEn?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AvisoAlumnoCountOrderByAggregateInput
    _max?: AvisoAlumnoMaxOrderByAggregateInput
    _min?: AvisoAlumnoMinOrderByAggregateInput
  }

  export type AvisoAlumnoScalarWhereWithAggregatesInput = {
    AND?: AvisoAlumnoScalarWhereWithAggregatesInput | AvisoAlumnoScalarWhereWithAggregatesInput[]
    OR?: AvisoAlumnoScalarWhereWithAggregatesInput[]
    NOT?: AvisoAlumnoScalarWhereWithAggregatesInput | AvisoAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AvisoAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"AvisoAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"AvisoAlumno"> | string
    avisoId?: StringWithAggregatesFilter<"AvisoAlumno"> | string
    titulo?: StringWithAggregatesFilter<"AvisoAlumno"> | string
    mensaje?: StringWithAggregatesFilter<"AvisoAlumno"> | string
    severidad?: StringWithAggregatesFilter<"AvisoAlumno"> | string
    publicadoEn?: DateTimeWithAggregatesFilter<"AvisoAlumno"> | Date | string
    metadata?: StringNullableWithAggregatesFilter<"AvisoAlumno"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"AvisoAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AvisoAlumno"> | Date | string
  }

  export type HistorialAlumnoWhereInput = {
    AND?: HistorialAlumnoWhereInput | HistorialAlumnoWhereInput[]
    OR?: HistorialAlumnoWhereInput[]
    NOT?: HistorialAlumnoWhereInput | HistorialAlumnoWhereInput[]
    id?: StringFilter<"HistorialAlumno"> | string
    periodoId?: StringFilter<"HistorialAlumno"> | string
    alumnoId?: StringFilter<"HistorialAlumno"> | string
    historialId?: StringFilter<"HistorialAlumno"> | string
    folio?: StringNullableFilter<"HistorialAlumno"> | string | null
    tipoExamen?: StringNullableFilter<"HistorialAlumno"> | string | null
    calificacionTexto?: StringNullableFilter<"HistorialAlumno"> | string | null
    aciertos?: IntNullableFilter<"HistorialAlumno"> | number | null
    totalReactivos?: IntNullableFilter<"HistorialAlumno"> | number | null
    fecha?: DateTimeFilter<"HistorialAlumno"> | Date | string
    metadata?: StringNullableFilter<"HistorialAlumno"> | string | null
    createdAt?: DateTimeFilter<"HistorialAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"HistorialAlumno"> | Date | string
  }

  export type HistorialAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    historialId?: SortOrder
    folio?: SortOrderInput | SortOrder
    tipoExamen?: SortOrderInput | SortOrder
    calificacionTexto?: SortOrderInput | SortOrder
    aciertos?: SortOrderInput | SortOrder
    totalReactivos?: SortOrderInput | SortOrder
    fecha?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type HistorialAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    periodoId_alumnoId_historialId?: HistorialAlumnoPeriodoIdAlumnoIdHistorialIdCompoundUniqueInput
    AND?: HistorialAlumnoWhereInput | HistorialAlumnoWhereInput[]
    OR?: HistorialAlumnoWhereInput[]
    NOT?: HistorialAlumnoWhereInput | HistorialAlumnoWhereInput[]
    periodoId?: StringFilter<"HistorialAlumno"> | string
    alumnoId?: StringFilter<"HistorialAlumno"> | string
    historialId?: StringFilter<"HistorialAlumno"> | string
    folio?: StringNullableFilter<"HistorialAlumno"> | string | null
    tipoExamen?: StringNullableFilter<"HistorialAlumno"> | string | null
    calificacionTexto?: StringNullableFilter<"HistorialAlumno"> | string | null
    aciertos?: IntNullableFilter<"HistorialAlumno"> | number | null
    totalReactivos?: IntNullableFilter<"HistorialAlumno"> | number | null
    fecha?: DateTimeFilter<"HistorialAlumno"> | Date | string
    metadata?: StringNullableFilter<"HistorialAlumno"> | string | null
    createdAt?: DateTimeFilter<"HistorialAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"HistorialAlumno"> | Date | string
  }, "id" | "periodoId_alumnoId_historialId">

  export type HistorialAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    historialId?: SortOrder
    folio?: SortOrderInput | SortOrder
    tipoExamen?: SortOrderInput | SortOrder
    calificacionTexto?: SortOrderInput | SortOrder
    aciertos?: SortOrderInput | SortOrder
    totalReactivos?: SortOrderInput | SortOrder
    fecha?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: HistorialAlumnoCountOrderByAggregateInput
    _avg?: HistorialAlumnoAvgOrderByAggregateInput
    _max?: HistorialAlumnoMaxOrderByAggregateInput
    _min?: HistorialAlumnoMinOrderByAggregateInput
    _sum?: HistorialAlumnoSumOrderByAggregateInput
  }

  export type HistorialAlumnoScalarWhereWithAggregatesInput = {
    AND?: HistorialAlumnoScalarWhereWithAggregatesInput | HistorialAlumnoScalarWhereWithAggregatesInput[]
    OR?: HistorialAlumnoScalarWhereWithAggregatesInput[]
    NOT?: HistorialAlumnoScalarWhereWithAggregatesInput | HistorialAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"HistorialAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"HistorialAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"HistorialAlumno"> | string
    historialId?: StringWithAggregatesFilter<"HistorialAlumno"> | string
    folio?: StringNullableWithAggregatesFilter<"HistorialAlumno"> | string | null
    tipoExamen?: StringNullableWithAggregatesFilter<"HistorialAlumno"> | string | null
    calificacionTexto?: StringNullableWithAggregatesFilter<"HistorialAlumno"> | string | null
    aciertos?: IntNullableWithAggregatesFilter<"HistorialAlumno"> | number | null
    totalReactivos?: IntNullableWithAggregatesFilter<"HistorialAlumno"> | number | null
    fecha?: DateTimeWithAggregatesFilter<"HistorialAlumno"> | Date | string
    metadata?: StringNullableWithAggregatesFilter<"HistorialAlumno"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"HistorialAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"HistorialAlumno"> | Date | string
  }

  export type CodigoAccesoWhereInput = {
    AND?: CodigoAccesoWhereInput | CodigoAccesoWhereInput[]
    OR?: CodigoAccesoWhereInput[]
    NOT?: CodigoAccesoWhereInput | CodigoAccesoWhereInput[]
    id?: StringFilter<"CodigoAcceso"> | string
    periodoId?: StringFilter<"CodigoAcceso"> | string
    codigo?: StringFilter<"CodigoAcceso"> | string
    expiraEn?: DateTimeFilter<"CodigoAcceso"> | Date | string
    usado?: BoolFilter<"CodigoAcceso"> | boolean
    createdAt?: DateTimeFilter<"CodigoAcceso"> | Date | string
    updatedAt?: DateTimeFilter<"CodigoAcceso"> | Date | string
  }

  export type CodigoAccesoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    codigo?: SortOrder
    expiraEn?: SortOrder
    usado?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CodigoAccesoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    codigo?: string
    AND?: CodigoAccesoWhereInput | CodigoAccesoWhereInput[]
    OR?: CodigoAccesoWhereInput[]
    NOT?: CodigoAccesoWhereInput | CodigoAccesoWhereInput[]
    periodoId?: StringFilter<"CodigoAcceso"> | string
    expiraEn?: DateTimeFilter<"CodigoAcceso"> | Date | string
    usado?: BoolFilter<"CodigoAcceso"> | boolean
    createdAt?: DateTimeFilter<"CodigoAcceso"> | Date | string
    updatedAt?: DateTimeFilter<"CodigoAcceso"> | Date | string
  }, "id" | "codigo">

  export type CodigoAccesoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    codigo?: SortOrder
    expiraEn?: SortOrder
    usado?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CodigoAccesoCountOrderByAggregateInput
    _max?: CodigoAccesoMaxOrderByAggregateInput
    _min?: CodigoAccesoMinOrderByAggregateInput
  }

  export type CodigoAccesoScalarWhereWithAggregatesInput = {
    AND?: CodigoAccesoScalarWhereWithAggregatesInput | CodigoAccesoScalarWhereWithAggregatesInput[]
    OR?: CodigoAccesoScalarWhereWithAggregatesInput[]
    NOT?: CodigoAccesoScalarWhereWithAggregatesInput | CodigoAccesoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CodigoAcceso"> | string
    periodoId?: StringWithAggregatesFilter<"CodigoAcceso"> | string
    codigo?: StringWithAggregatesFilter<"CodigoAcceso"> | string
    expiraEn?: DateTimeWithAggregatesFilter<"CodigoAcceso"> | Date | string
    usado?: BoolWithAggregatesFilter<"CodigoAcceso"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"CodigoAcceso"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CodigoAcceso"> | Date | string
  }

  export type EventoUsoAlumnoWhereInput = {
    AND?: EventoUsoAlumnoWhereInput | EventoUsoAlumnoWhereInput[]
    OR?: EventoUsoAlumnoWhereInput[]
    NOT?: EventoUsoAlumnoWhereInput | EventoUsoAlumnoWhereInput[]
    id?: StringFilter<"EventoUsoAlumno"> | string
    periodoId?: StringFilter<"EventoUsoAlumno"> | string
    alumnoId?: StringFilter<"EventoUsoAlumno"> | string
    sessionId?: StringNullableFilter<"EventoUsoAlumno"> | string | null
    pantalla?: StringNullableFilter<"EventoUsoAlumno"> | string | null
    accion?: StringFilter<"EventoUsoAlumno"> | string
    exito?: BoolNullableFilter<"EventoUsoAlumno"> | boolean | null
    duracionMs?: IntNullableFilter<"EventoUsoAlumno"> | number | null
    meta?: StringNullableFilter<"EventoUsoAlumno"> | string | null
    createdAt?: DateTimeFilter<"EventoUsoAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"EventoUsoAlumno"> | Date | string
  }

  export type EventoUsoAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    sessionId?: SortOrderInput | SortOrder
    pantalla?: SortOrderInput | SortOrder
    accion?: SortOrder
    exito?: SortOrderInput | SortOrder
    duracionMs?: SortOrderInput | SortOrder
    meta?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EventoUsoAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: EventoUsoAlumnoWhereInput | EventoUsoAlumnoWhereInput[]
    OR?: EventoUsoAlumnoWhereInput[]
    NOT?: EventoUsoAlumnoWhereInput | EventoUsoAlumnoWhereInput[]
    periodoId?: StringFilter<"EventoUsoAlumno"> | string
    alumnoId?: StringFilter<"EventoUsoAlumno"> | string
    sessionId?: StringNullableFilter<"EventoUsoAlumno"> | string | null
    pantalla?: StringNullableFilter<"EventoUsoAlumno"> | string | null
    accion?: StringFilter<"EventoUsoAlumno"> | string
    exito?: BoolNullableFilter<"EventoUsoAlumno"> | boolean | null
    duracionMs?: IntNullableFilter<"EventoUsoAlumno"> | number | null
    meta?: StringNullableFilter<"EventoUsoAlumno"> | string | null
    createdAt?: DateTimeFilter<"EventoUsoAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"EventoUsoAlumno"> | Date | string
  }, "id">

  export type EventoUsoAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    sessionId?: SortOrderInput | SortOrder
    pantalla?: SortOrderInput | SortOrder
    accion?: SortOrder
    exito?: SortOrderInput | SortOrder
    duracionMs?: SortOrderInput | SortOrder
    meta?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: EventoUsoAlumnoCountOrderByAggregateInput
    _avg?: EventoUsoAlumnoAvgOrderByAggregateInput
    _max?: EventoUsoAlumnoMaxOrderByAggregateInput
    _min?: EventoUsoAlumnoMinOrderByAggregateInput
    _sum?: EventoUsoAlumnoSumOrderByAggregateInput
  }

  export type EventoUsoAlumnoScalarWhereWithAggregatesInput = {
    AND?: EventoUsoAlumnoScalarWhereWithAggregatesInput | EventoUsoAlumnoScalarWhereWithAggregatesInput[]
    OR?: EventoUsoAlumnoScalarWhereWithAggregatesInput[]
    NOT?: EventoUsoAlumnoScalarWhereWithAggregatesInput | EventoUsoAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"EventoUsoAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"EventoUsoAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"EventoUsoAlumno"> | string
    sessionId?: StringNullableWithAggregatesFilter<"EventoUsoAlumno"> | string | null
    pantalla?: StringNullableWithAggregatesFilter<"EventoUsoAlumno"> | string | null
    accion?: StringWithAggregatesFilter<"EventoUsoAlumno"> | string
    exito?: BoolNullableWithAggregatesFilter<"EventoUsoAlumno"> | boolean | null
    duracionMs?: IntNullableWithAggregatesFilter<"EventoUsoAlumno"> | number | null
    meta?: StringNullableWithAggregatesFilter<"EventoUsoAlumno"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"EventoUsoAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"EventoUsoAlumno"> | Date | string
  }

  export type SesionAlumnoWhereInput = {
    AND?: SesionAlumnoWhereInput | SesionAlumnoWhereInput[]
    OR?: SesionAlumnoWhereInput[]
    NOT?: SesionAlumnoWhereInput | SesionAlumnoWhereInput[]
    id?: StringFilter<"SesionAlumno"> | string
    periodoId?: StringFilter<"SesionAlumno"> | string
    alumnoId?: StringFilter<"SesionAlumno"> | string
    tokenHash?: StringFilter<"SesionAlumno"> | string
    expiraEn?: DateTimeFilter<"SesionAlumno"> | Date | string
    createdAt?: DateTimeFilter<"SesionAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"SesionAlumno"> | Date | string
  }

  export type SesionAlumnoOrderByWithRelationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    tokenHash?: SortOrder
    expiraEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SesionAlumnoWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    tokenHash?: string
    AND?: SesionAlumnoWhereInput | SesionAlumnoWhereInput[]
    OR?: SesionAlumnoWhereInput[]
    NOT?: SesionAlumnoWhereInput | SesionAlumnoWhereInput[]
    periodoId?: StringFilter<"SesionAlumno"> | string
    alumnoId?: StringFilter<"SesionAlumno"> | string
    expiraEn?: DateTimeFilter<"SesionAlumno"> | Date | string
    createdAt?: DateTimeFilter<"SesionAlumno"> | Date | string
    updatedAt?: DateTimeFilter<"SesionAlumno"> | Date | string
  }, "id" | "tokenHash">

  export type SesionAlumnoOrderByWithAggregationInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    tokenHash?: SortOrder
    expiraEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SesionAlumnoCountOrderByAggregateInput
    _max?: SesionAlumnoMaxOrderByAggregateInput
    _min?: SesionAlumnoMinOrderByAggregateInput
  }

  export type SesionAlumnoScalarWhereWithAggregatesInput = {
    AND?: SesionAlumnoScalarWhereWithAggregatesInput | SesionAlumnoScalarWhereWithAggregatesInput[]
    OR?: SesionAlumnoScalarWhereWithAggregatesInput[]
    NOT?: SesionAlumnoScalarWhereWithAggregatesInput | SesionAlumnoScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SesionAlumno"> | string
    periodoId?: StringWithAggregatesFilter<"SesionAlumno"> | string
    alumnoId?: StringWithAggregatesFilter<"SesionAlumno"> | string
    tokenHash?: StringWithAggregatesFilter<"SesionAlumno"> | string
    expiraEn?: DateTimeWithAggregatesFilter<"SesionAlumno"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"SesionAlumno"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SesionAlumno"> | Date | string
  }

  export type SolicitudRevisionWhereInput = {
    AND?: SolicitudRevisionWhereInput | SolicitudRevisionWhereInput[]
    OR?: SolicitudRevisionWhereInput[]
    NOT?: SolicitudRevisionWhereInput | SolicitudRevisionWhereInput[]
    id?: StringFilter<"SolicitudRevision"> | string
    externoId?: StringFilter<"SolicitudRevision"> | string
    periodoId?: StringFilter<"SolicitudRevision"> | string
    docenteId?: StringFilter<"SolicitudRevision"> | string
    alumnoId?: StringFilter<"SolicitudRevision"> | string
    examenGeneradoId?: StringNullableFilter<"SolicitudRevision"> | string | null
    folio?: StringFilter<"SolicitudRevision"> | string
    numeroPregunta?: IntFilter<"SolicitudRevision"> | number
    comentario?: StringNullableFilter<"SolicitudRevision"> | string | null
    estado?: StringFilter<"SolicitudRevision"> | string
    solicitadoEn?: DateTimeFilter<"SolicitudRevision"> | Date | string
    atendidoEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    respuestaDocente?: StringNullableFilter<"SolicitudRevision"> | string | null
    firmaDocente?: StringNullableFilter<"SolicitudRevision"> | string | null
    firmadoEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    cerradoEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    conformidadAlumno?: BoolFilter<"SolicitudRevision"> | boolean
    conformidadActualizadaEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    origen?: StringFilter<"SolicitudRevision"> | string
    createdAt?: DateTimeFilter<"SolicitudRevision"> | Date | string
    updatedAt?: DateTimeFilter<"SolicitudRevision"> | Date | string
  }

  export type SolicitudRevisionOrderByWithRelationInput = {
    id?: SortOrder
    externoId?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrderInput | SortOrder
    folio?: SortOrder
    numeroPregunta?: SortOrder
    comentario?: SortOrderInput | SortOrder
    estado?: SortOrder
    solicitadoEn?: SortOrder
    atendidoEn?: SortOrderInput | SortOrder
    respuestaDocente?: SortOrderInput | SortOrder
    firmaDocente?: SortOrderInput | SortOrder
    firmadoEn?: SortOrderInput | SortOrder
    cerradoEn?: SortOrderInput | SortOrder
    conformidadAlumno?: SortOrder
    conformidadActualizadaEn?: SortOrderInput | SortOrder
    origen?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SolicitudRevisionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    externoId?: string
    AND?: SolicitudRevisionWhereInput | SolicitudRevisionWhereInput[]
    OR?: SolicitudRevisionWhereInput[]
    NOT?: SolicitudRevisionWhereInput | SolicitudRevisionWhereInput[]
    periodoId?: StringFilter<"SolicitudRevision"> | string
    docenteId?: StringFilter<"SolicitudRevision"> | string
    alumnoId?: StringFilter<"SolicitudRevision"> | string
    examenGeneradoId?: StringNullableFilter<"SolicitudRevision"> | string | null
    folio?: StringFilter<"SolicitudRevision"> | string
    numeroPregunta?: IntFilter<"SolicitudRevision"> | number
    comentario?: StringNullableFilter<"SolicitudRevision"> | string | null
    estado?: StringFilter<"SolicitudRevision"> | string
    solicitadoEn?: DateTimeFilter<"SolicitudRevision"> | Date | string
    atendidoEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    respuestaDocente?: StringNullableFilter<"SolicitudRevision"> | string | null
    firmaDocente?: StringNullableFilter<"SolicitudRevision"> | string | null
    firmadoEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    cerradoEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    conformidadAlumno?: BoolFilter<"SolicitudRevision"> | boolean
    conformidadActualizadaEn?: DateTimeNullableFilter<"SolicitudRevision"> | Date | string | null
    origen?: StringFilter<"SolicitudRevision"> | string
    createdAt?: DateTimeFilter<"SolicitudRevision"> | Date | string
    updatedAt?: DateTimeFilter<"SolicitudRevision"> | Date | string
  }, "id" | "externoId">

  export type SolicitudRevisionOrderByWithAggregationInput = {
    id?: SortOrder
    externoId?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrderInput | SortOrder
    folio?: SortOrder
    numeroPregunta?: SortOrder
    comentario?: SortOrderInput | SortOrder
    estado?: SortOrder
    solicitadoEn?: SortOrder
    atendidoEn?: SortOrderInput | SortOrder
    respuestaDocente?: SortOrderInput | SortOrder
    firmaDocente?: SortOrderInput | SortOrder
    firmadoEn?: SortOrderInput | SortOrder
    cerradoEn?: SortOrderInput | SortOrder
    conformidadAlumno?: SortOrder
    conformidadActualizadaEn?: SortOrderInput | SortOrder
    origen?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SolicitudRevisionCountOrderByAggregateInput
    _avg?: SolicitudRevisionAvgOrderByAggregateInput
    _max?: SolicitudRevisionMaxOrderByAggregateInput
    _min?: SolicitudRevisionMinOrderByAggregateInput
    _sum?: SolicitudRevisionSumOrderByAggregateInput
  }

  export type SolicitudRevisionScalarWhereWithAggregatesInput = {
    AND?: SolicitudRevisionScalarWhereWithAggregatesInput | SolicitudRevisionScalarWhereWithAggregatesInput[]
    OR?: SolicitudRevisionScalarWhereWithAggregatesInput[]
    NOT?: SolicitudRevisionScalarWhereWithAggregatesInput | SolicitudRevisionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    externoId?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    periodoId?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    docenteId?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    alumnoId?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    examenGeneradoId?: StringNullableWithAggregatesFilter<"SolicitudRevision"> | string | null
    folio?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    numeroPregunta?: IntWithAggregatesFilter<"SolicitudRevision"> | number
    comentario?: StringNullableWithAggregatesFilter<"SolicitudRevision"> | string | null
    estado?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    solicitadoEn?: DateTimeWithAggregatesFilter<"SolicitudRevision"> | Date | string
    atendidoEn?: DateTimeNullableWithAggregatesFilter<"SolicitudRevision"> | Date | string | null
    respuestaDocente?: StringNullableWithAggregatesFilter<"SolicitudRevision"> | string | null
    firmaDocente?: StringNullableWithAggregatesFilter<"SolicitudRevision"> | string | null
    firmadoEn?: DateTimeNullableWithAggregatesFilter<"SolicitudRevision"> | Date | string | null
    cerradoEn?: DateTimeNullableWithAggregatesFilter<"SolicitudRevision"> | Date | string | null
    conformidadAlumno?: BoolWithAggregatesFilter<"SolicitudRevision"> | boolean
    conformidadActualizadaEn?: DateTimeNullableWithAggregatesFilter<"SolicitudRevision"> | Date | string | null
    origen?: StringWithAggregatesFilter<"SolicitudRevision"> | string
    createdAt?: DateTimeWithAggregatesFilter<"SolicitudRevision"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SolicitudRevision"> | Date | string
  }

  export type PaqueteSyncDocenteWhereInput = {
    AND?: PaqueteSyncDocenteWhereInput | PaqueteSyncDocenteWhereInput[]
    OR?: PaqueteSyncDocenteWhereInput[]
    NOT?: PaqueteSyncDocenteWhereInput | PaqueteSyncDocenteWhereInput[]
    id?: StringFilter<"PaqueteSyncDocente"> | string
    docenteId?: StringFilter<"PaqueteSyncDocente"> | string
    paqueteBase64?: StringFilter<"PaqueteSyncDocente"> | string
    checksumSha256?: StringNullableFilter<"PaqueteSyncDocente"> | string | null
    schemaVersion?: IntFilter<"PaqueteSyncDocente"> | number
    exportadoEn?: DateTimeNullableFilter<"PaqueteSyncDocente"> | Date | string | null
    desde?: DateTimeNullableFilter<"PaqueteSyncDocente"> | Date | string | null
    periodoId?: StringNullableFilter<"PaqueteSyncDocente"> | string | null
    conteos?: StringNullableFilter<"PaqueteSyncDocente"> | string | null
    createdAt?: DateTimeFilter<"PaqueteSyncDocente"> | Date | string
    updatedAt?: DateTimeFilter<"PaqueteSyncDocente"> | Date | string
  }

  export type PaqueteSyncDocenteOrderByWithRelationInput = {
    id?: SortOrder
    docenteId?: SortOrder
    paqueteBase64?: SortOrder
    checksumSha256?: SortOrderInput | SortOrder
    schemaVersion?: SortOrder
    exportadoEn?: SortOrderInput | SortOrder
    desde?: SortOrderInput | SortOrder
    periodoId?: SortOrderInput | SortOrder
    conteos?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PaqueteSyncDocenteWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PaqueteSyncDocenteWhereInput | PaqueteSyncDocenteWhereInput[]
    OR?: PaqueteSyncDocenteWhereInput[]
    NOT?: PaqueteSyncDocenteWhereInput | PaqueteSyncDocenteWhereInput[]
    docenteId?: StringFilter<"PaqueteSyncDocente"> | string
    paqueteBase64?: StringFilter<"PaqueteSyncDocente"> | string
    checksumSha256?: StringNullableFilter<"PaqueteSyncDocente"> | string | null
    schemaVersion?: IntFilter<"PaqueteSyncDocente"> | number
    exportadoEn?: DateTimeNullableFilter<"PaqueteSyncDocente"> | Date | string | null
    desde?: DateTimeNullableFilter<"PaqueteSyncDocente"> | Date | string | null
    periodoId?: StringNullableFilter<"PaqueteSyncDocente"> | string | null
    conteos?: StringNullableFilter<"PaqueteSyncDocente"> | string | null
    createdAt?: DateTimeFilter<"PaqueteSyncDocente"> | Date | string
    updatedAt?: DateTimeFilter<"PaqueteSyncDocente"> | Date | string
  }, "id">

  export type PaqueteSyncDocenteOrderByWithAggregationInput = {
    id?: SortOrder
    docenteId?: SortOrder
    paqueteBase64?: SortOrder
    checksumSha256?: SortOrderInput | SortOrder
    schemaVersion?: SortOrder
    exportadoEn?: SortOrderInput | SortOrder
    desde?: SortOrderInput | SortOrder
    periodoId?: SortOrderInput | SortOrder
    conteos?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PaqueteSyncDocenteCountOrderByAggregateInput
    _avg?: PaqueteSyncDocenteAvgOrderByAggregateInput
    _max?: PaqueteSyncDocenteMaxOrderByAggregateInput
    _min?: PaqueteSyncDocenteMinOrderByAggregateInput
    _sum?: PaqueteSyncDocenteSumOrderByAggregateInput
  }

  export type PaqueteSyncDocenteScalarWhereWithAggregatesInput = {
    AND?: PaqueteSyncDocenteScalarWhereWithAggregatesInput | PaqueteSyncDocenteScalarWhereWithAggregatesInput[]
    OR?: PaqueteSyncDocenteScalarWhereWithAggregatesInput[]
    NOT?: PaqueteSyncDocenteScalarWhereWithAggregatesInput | PaqueteSyncDocenteScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PaqueteSyncDocente"> | string
    docenteId?: StringWithAggregatesFilter<"PaqueteSyncDocente"> | string
    paqueteBase64?: StringWithAggregatesFilter<"PaqueteSyncDocente"> | string
    checksumSha256?: StringNullableWithAggregatesFilter<"PaqueteSyncDocente"> | string | null
    schemaVersion?: IntWithAggregatesFilter<"PaqueteSyncDocente"> | number
    exportadoEn?: DateTimeNullableWithAggregatesFilter<"PaqueteSyncDocente"> | Date | string | null
    desde?: DateTimeNullableWithAggregatesFilter<"PaqueteSyncDocente"> | Date | string | null
    periodoId?: StringNullableWithAggregatesFilter<"PaqueteSyncDocente"> | string | null
    conteos?: StringNullableWithAggregatesFilter<"PaqueteSyncDocente"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PaqueteSyncDocente"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PaqueteSyncDocente"> | Date | string
  }

  export type PerfilAlumnoCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    matricula: string
    nombreCompleto: string
    grupo?: string | null
    docenteId?: string | null
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PerfilAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    matricula: string
    nombreCompleto: string
    grupo?: string | null
    docenteId?: string | null
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PerfilAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    docenteId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PerfilAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    docenteId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PerfilAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    alumnoId: string
    matricula: string
    nombreCompleto: string
    grupo?: string | null
    docenteId?: string | null
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PerfilAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    docenteId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PerfilAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    docenteId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResultadoAlumnoCreateInput = {
    id?: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId?: string | null
    matricula: string
    nombreCompleto: string
    grupo?: string | null
    folio: string
    tipoExamen: string
    totalReactivos?: number | null
    aciertos?: number | null
    calificacionExamenFinalTexto: string
    calificacionParcialTexto?: string | null
    calificacionGlobalTexto?: string | null
    evaluacionContinuaTexto?: string | null
    proyectoTexto?: string | null
    politicaId?: string | null
    versionPolitica?: number | null
    componentesExamen?: string | null
    bloqueContinuaDecimal?: number | null
    bloqueExamenesDecimal?: number | null
    finalDecimal?: number | null
    finalRedondeada?: number | null
    respuestasDetectadas?: string | null
    comparativaRespuestas?: string | null
    omrCapturas?: string | null
    omrAuditoria?: string | null
    banderas?: string | null
    pdfComprimidoBase64?: string | null
    publicadoEn?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResultadoAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId?: string | null
    matricula: string
    nombreCompleto: string
    grupo?: string | null
    folio: string
    tipoExamen: string
    totalReactivos?: number | null
    aciertos?: number | null
    calificacionExamenFinalTexto: string
    calificacionParcialTexto?: string | null
    calificacionGlobalTexto?: string | null
    evaluacionContinuaTexto?: string | null
    proyectoTexto?: string | null
    politicaId?: string | null
    versionPolitica?: number | null
    componentesExamen?: string | null
    bloqueContinuaDecimal?: number | null
    bloqueExamenesDecimal?: number | null
    finalDecimal?: number | null
    finalRedondeada?: number | null
    respuestasDetectadas?: string | null
    comparativaRespuestas?: string | null
    omrCapturas?: string | null
    omrAuditoria?: string | null
    banderas?: string | null
    pdfComprimidoBase64?: string | null
    publicadoEn?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResultadoAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    tipoExamen?: StringFieldUpdateOperationsInput | string
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    calificacionExamenFinalTexto?: StringFieldUpdateOperationsInput | string
    calificacionParcialTexto?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionGlobalTexto?: NullableStringFieldUpdateOperationsInput | string | null
    evaluacionContinuaTexto?: NullableStringFieldUpdateOperationsInput | string | null
    proyectoTexto?: NullableStringFieldUpdateOperationsInput | string | null
    politicaId?: NullableStringFieldUpdateOperationsInput | string | null
    versionPolitica?: NullableIntFieldUpdateOperationsInput | number | null
    componentesExamen?: NullableStringFieldUpdateOperationsInput | string | null
    bloqueContinuaDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    bloqueExamenesDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalRedondeada?: NullableFloatFieldUpdateOperationsInput | number | null
    respuestasDetectadas?: NullableStringFieldUpdateOperationsInput | string | null
    comparativaRespuestas?: NullableStringFieldUpdateOperationsInput | string | null
    omrCapturas?: NullableStringFieldUpdateOperationsInput | string | null
    omrAuditoria?: NullableStringFieldUpdateOperationsInput | string | null
    banderas?: NullableStringFieldUpdateOperationsInput | string | null
    pdfComprimidoBase64?: NullableStringFieldUpdateOperationsInput | string | null
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResultadoAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    tipoExamen?: StringFieldUpdateOperationsInput | string
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    calificacionExamenFinalTexto?: StringFieldUpdateOperationsInput | string
    calificacionParcialTexto?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionGlobalTexto?: NullableStringFieldUpdateOperationsInput | string | null
    evaluacionContinuaTexto?: NullableStringFieldUpdateOperationsInput | string | null
    proyectoTexto?: NullableStringFieldUpdateOperationsInput | string | null
    politicaId?: NullableStringFieldUpdateOperationsInput | string | null
    versionPolitica?: NullableIntFieldUpdateOperationsInput | number | null
    componentesExamen?: NullableStringFieldUpdateOperationsInput | string | null
    bloqueContinuaDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    bloqueExamenesDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalRedondeada?: NullableFloatFieldUpdateOperationsInput | number | null
    respuestasDetectadas?: NullableStringFieldUpdateOperationsInput | string | null
    comparativaRespuestas?: NullableStringFieldUpdateOperationsInput | string | null
    omrCapturas?: NullableStringFieldUpdateOperationsInput | string | null
    omrAuditoria?: NullableStringFieldUpdateOperationsInput | string | null
    banderas?: NullableStringFieldUpdateOperationsInput | string | null
    pdfComprimidoBase64?: NullableStringFieldUpdateOperationsInput | string | null
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResultadoAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId?: string | null
    matricula: string
    nombreCompleto: string
    grupo?: string | null
    folio: string
    tipoExamen: string
    totalReactivos?: number | null
    aciertos?: number | null
    calificacionExamenFinalTexto: string
    calificacionParcialTexto?: string | null
    calificacionGlobalTexto?: string | null
    evaluacionContinuaTexto?: string | null
    proyectoTexto?: string | null
    politicaId?: string | null
    versionPolitica?: number | null
    componentesExamen?: string | null
    bloqueContinuaDecimal?: number | null
    bloqueExamenesDecimal?: number | null
    finalDecimal?: number | null
    finalRedondeada?: number | null
    respuestasDetectadas?: string | null
    comparativaRespuestas?: string | null
    omrCapturas?: string | null
    omrAuditoria?: string | null
    banderas?: string | null
    pdfComprimidoBase64?: string | null
    publicadoEn?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResultadoAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    tipoExamen?: StringFieldUpdateOperationsInput | string
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    calificacionExamenFinalTexto?: StringFieldUpdateOperationsInput | string
    calificacionParcialTexto?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionGlobalTexto?: NullableStringFieldUpdateOperationsInput | string | null
    evaluacionContinuaTexto?: NullableStringFieldUpdateOperationsInput | string | null
    proyectoTexto?: NullableStringFieldUpdateOperationsInput | string | null
    politicaId?: NullableStringFieldUpdateOperationsInput | string | null
    versionPolitica?: NullableIntFieldUpdateOperationsInput | number | null
    componentesExamen?: NullableStringFieldUpdateOperationsInput | string | null
    bloqueContinuaDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    bloqueExamenesDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalRedondeada?: NullableFloatFieldUpdateOperationsInput | number | null
    respuestasDetectadas?: NullableStringFieldUpdateOperationsInput | string | null
    comparativaRespuestas?: NullableStringFieldUpdateOperationsInput | string | null
    omrCapturas?: NullableStringFieldUpdateOperationsInput | string | null
    omrAuditoria?: NullableStringFieldUpdateOperationsInput | string | null
    banderas?: NullableStringFieldUpdateOperationsInput | string | null
    pdfComprimidoBase64?: NullableStringFieldUpdateOperationsInput | string | null
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResultadoAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    matricula?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    grupo?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    tipoExamen?: StringFieldUpdateOperationsInput | string
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    calificacionExamenFinalTexto?: StringFieldUpdateOperationsInput | string
    calificacionParcialTexto?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionGlobalTexto?: NullableStringFieldUpdateOperationsInput | string | null
    evaluacionContinuaTexto?: NullableStringFieldUpdateOperationsInput | string | null
    proyectoTexto?: NullableStringFieldUpdateOperationsInput | string | null
    politicaId?: NullableStringFieldUpdateOperationsInput | string | null
    versionPolitica?: NullableIntFieldUpdateOperationsInput | number | null
    componentesExamen?: NullableStringFieldUpdateOperationsInput | string | null
    bloqueContinuaDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    bloqueExamenesDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalDecimal?: NullableFloatFieldUpdateOperationsInput | number | null
    finalRedondeada?: NullableFloatFieldUpdateOperationsInput | number | null
    respuestasDetectadas?: NullableStringFieldUpdateOperationsInput | string | null
    comparativaRespuestas?: NullableStringFieldUpdateOperationsInput | string | null
    omrCapturas?: NullableStringFieldUpdateOperationsInput | string | null
    omrAuditoria?: NullableStringFieldUpdateOperationsInput | string | null
    banderas?: NullableStringFieldUpdateOperationsInput | string | null
    pdfComprimidoBase64?: NullableStringFieldUpdateOperationsInput | string | null
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MateriaAlumnoCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    materiaId: string
    nombre: string
    docente?: string | null
    estado?: string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MateriaAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    materiaId: string
    nombre: string
    docente?: string | null
    estado?: string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MateriaAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    materiaId?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    docente?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MateriaAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    materiaId?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    docente?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MateriaAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    alumnoId: string
    materiaId: string
    nombre: string
    docente?: string | null
    estado?: string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MateriaAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    materiaId?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    docente?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MateriaAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    materiaId?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    docente?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AgendaAlumnoCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    agendaId: string
    titulo: string
    descripcion?: string | null
    fecha: Date | string
    tipo?: string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AgendaAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    agendaId: string
    titulo: string
    descripcion?: string | null
    fecha: Date | string
    tipo?: string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AgendaAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    agendaId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    descripcion?: NullableStringFieldUpdateOperationsInput | string | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    tipo?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AgendaAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    agendaId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    descripcion?: NullableStringFieldUpdateOperationsInput | string | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    tipo?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AgendaAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    alumnoId: string
    agendaId: string
    titulo: string
    descripcion?: string | null
    fecha: Date | string
    tipo?: string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AgendaAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    agendaId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    descripcion?: NullableStringFieldUpdateOperationsInput | string | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    tipo?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AgendaAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    agendaId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    descripcion?: NullableStringFieldUpdateOperationsInput | string | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    tipo?: StringFieldUpdateOperationsInput | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AvisoAlumnoCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    avisoId: string
    titulo: string
    mensaje: string
    severidad?: string
    publicadoEn?: Date | string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AvisoAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    avisoId: string
    titulo: string
    mensaje: string
    severidad?: string
    publicadoEn?: Date | string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AvisoAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    avisoId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    mensaje?: StringFieldUpdateOperationsInput | string
    severidad?: StringFieldUpdateOperationsInput | string
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AvisoAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    avisoId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    mensaje?: StringFieldUpdateOperationsInput | string
    severidad?: StringFieldUpdateOperationsInput | string
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AvisoAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    alumnoId: string
    avisoId: string
    titulo: string
    mensaje: string
    severidad?: string
    publicadoEn?: Date | string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AvisoAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    avisoId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    mensaje?: StringFieldUpdateOperationsInput | string
    severidad?: StringFieldUpdateOperationsInput | string
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AvisoAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    avisoId?: StringFieldUpdateOperationsInput | string
    titulo?: StringFieldUpdateOperationsInput | string
    mensaje?: StringFieldUpdateOperationsInput | string
    severidad?: StringFieldUpdateOperationsInput | string
    publicadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HistorialAlumnoCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    historialId: string
    folio?: string | null
    tipoExamen?: string | null
    calificacionTexto?: string | null
    aciertos?: number | null
    totalReactivos?: number | null
    fecha?: Date | string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type HistorialAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    historialId: string
    folio?: string | null
    tipoExamen?: string | null
    calificacionTexto?: string | null
    aciertos?: number | null
    totalReactivos?: number | null
    fecha?: Date | string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type HistorialAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    historialId?: StringFieldUpdateOperationsInput | string
    folio?: NullableStringFieldUpdateOperationsInput | string | null
    tipoExamen?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionTexto?: NullableStringFieldUpdateOperationsInput | string | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HistorialAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    historialId?: StringFieldUpdateOperationsInput | string
    folio?: NullableStringFieldUpdateOperationsInput | string | null
    tipoExamen?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionTexto?: NullableStringFieldUpdateOperationsInput | string | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HistorialAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    alumnoId: string
    historialId: string
    folio?: string | null
    tipoExamen?: string | null
    calificacionTexto?: string | null
    aciertos?: number | null
    totalReactivos?: number | null
    fecha?: Date | string
    metadata?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type HistorialAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    historialId?: StringFieldUpdateOperationsInput | string
    folio?: NullableStringFieldUpdateOperationsInput | string | null
    tipoExamen?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionTexto?: NullableStringFieldUpdateOperationsInput | string | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HistorialAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    historialId?: StringFieldUpdateOperationsInput | string
    folio?: NullableStringFieldUpdateOperationsInput | string | null
    tipoExamen?: NullableStringFieldUpdateOperationsInput | string | null
    calificacionTexto?: NullableStringFieldUpdateOperationsInput | string | null
    aciertos?: NullableIntFieldUpdateOperationsInput | number | null
    totalReactivos?: NullableIntFieldUpdateOperationsInput | number | null
    fecha?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CodigoAccesoCreateInput = {
    id?: string
    periodoId: string
    codigo: string
    expiraEn: Date | string
    usado?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CodigoAccesoUncheckedCreateInput = {
    id?: string
    periodoId: string
    codigo: string
    expiraEn: Date | string
    usado?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CodigoAccesoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    codigo?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    usado?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CodigoAccesoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    codigo?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    usado?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CodigoAccesoCreateManyInput = {
    id?: string
    periodoId: string
    codigo: string
    expiraEn: Date | string
    usado?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CodigoAccesoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    codigo?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    usado?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CodigoAccesoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    codigo?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    usado?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventoUsoAlumnoCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    sessionId?: string | null
    pantalla?: string | null
    accion: string
    exito?: boolean | null
    duracionMs?: number | null
    meta?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type EventoUsoAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    sessionId?: string | null
    pantalla?: string | null
    accion: string
    exito?: boolean | null
    duracionMs?: number | null
    meta?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type EventoUsoAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    pantalla?: NullableStringFieldUpdateOperationsInput | string | null
    accion?: StringFieldUpdateOperationsInput | string
    exito?: NullableBoolFieldUpdateOperationsInput | boolean | null
    duracionMs?: NullableIntFieldUpdateOperationsInput | number | null
    meta?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventoUsoAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    pantalla?: NullableStringFieldUpdateOperationsInput | string | null
    accion?: StringFieldUpdateOperationsInput | string
    exito?: NullableBoolFieldUpdateOperationsInput | boolean | null
    duracionMs?: NullableIntFieldUpdateOperationsInput | number | null
    meta?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventoUsoAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    alumnoId: string
    sessionId?: string | null
    pantalla?: string | null
    accion: string
    exito?: boolean | null
    duracionMs?: number | null
    meta?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type EventoUsoAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    pantalla?: NullableStringFieldUpdateOperationsInput | string | null
    accion?: StringFieldUpdateOperationsInput | string
    exito?: NullableBoolFieldUpdateOperationsInput | boolean | null
    duracionMs?: NullableIntFieldUpdateOperationsInput | number | null
    meta?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventoUsoAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    sessionId?: NullableStringFieldUpdateOperationsInput | string | null
    pantalla?: NullableStringFieldUpdateOperationsInput | string | null
    accion?: StringFieldUpdateOperationsInput | string
    exito?: NullableBoolFieldUpdateOperationsInput | boolean | null
    duracionMs?: NullableIntFieldUpdateOperationsInput | number | null
    meta?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SesionAlumnoCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    tokenHash: string
    expiraEn: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SesionAlumnoUncheckedCreateInput = {
    id?: string
    periodoId: string
    alumnoId: string
    tokenHash: string
    expiraEn: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SesionAlumnoUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SesionAlumnoUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SesionAlumnoCreateManyInput = {
    id?: string
    periodoId: string
    alumnoId: string
    tokenHash: string
    expiraEn: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SesionAlumnoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SesionAlumnoUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    expiraEn?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SolicitudRevisionCreateInput = {
    id?: string
    externoId: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId?: string | null
    folio: string
    numeroPregunta: number
    comentario?: string | null
    estado?: string
    solicitadoEn: Date | string
    atendidoEn?: Date | string | null
    respuestaDocente?: string | null
    firmaDocente?: string | null
    firmadoEn?: Date | string | null
    cerradoEn?: Date | string | null
    conformidadAlumno?: boolean
    conformidadActualizadaEn?: Date | string | null
    origen?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SolicitudRevisionUncheckedCreateInput = {
    id?: string
    externoId: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId?: string | null
    folio: string
    numeroPregunta: number
    comentario?: string | null
    estado?: string
    solicitadoEn: Date | string
    atendidoEn?: Date | string | null
    respuestaDocente?: string | null
    firmaDocente?: string | null
    firmadoEn?: Date | string | null
    cerradoEn?: Date | string | null
    conformidadAlumno?: boolean
    conformidadActualizadaEn?: Date | string | null
    origen?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SolicitudRevisionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    externoId?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    numeroPregunta?: IntFieldUpdateOperationsInput | number
    comentario?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    solicitadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    atendidoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    respuestaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cerradoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    conformidadAlumno?: BoolFieldUpdateOperationsInput | boolean
    conformidadActualizadaEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    origen?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SolicitudRevisionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    externoId?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    numeroPregunta?: IntFieldUpdateOperationsInput | number
    comentario?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    solicitadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    atendidoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    respuestaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cerradoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    conformidadAlumno?: BoolFieldUpdateOperationsInput | boolean
    conformidadActualizadaEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    origen?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SolicitudRevisionCreateManyInput = {
    id?: string
    externoId: string
    periodoId: string
    docenteId: string
    alumnoId: string
    examenGeneradoId?: string | null
    folio: string
    numeroPregunta: number
    comentario?: string | null
    estado?: string
    solicitadoEn: Date | string
    atendidoEn?: Date | string | null
    respuestaDocente?: string | null
    firmaDocente?: string | null
    firmadoEn?: Date | string | null
    cerradoEn?: Date | string | null
    conformidadAlumno?: boolean
    conformidadActualizadaEn?: Date | string | null
    origen?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SolicitudRevisionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    externoId?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    numeroPregunta?: IntFieldUpdateOperationsInput | number
    comentario?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    solicitadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    atendidoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    respuestaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cerradoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    conformidadAlumno?: BoolFieldUpdateOperationsInput | boolean
    conformidadActualizadaEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    origen?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SolicitudRevisionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    externoId?: StringFieldUpdateOperationsInput | string
    periodoId?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    alumnoId?: StringFieldUpdateOperationsInput | string
    examenGeneradoId?: NullableStringFieldUpdateOperationsInput | string | null
    folio?: StringFieldUpdateOperationsInput | string
    numeroPregunta?: IntFieldUpdateOperationsInput | number
    comentario?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    solicitadoEn?: DateTimeFieldUpdateOperationsInput | Date | string
    atendidoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    respuestaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmaDocente?: NullableStringFieldUpdateOperationsInput | string | null
    firmadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cerradoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    conformidadAlumno?: BoolFieldUpdateOperationsInput | boolean
    conformidadActualizadaEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    origen?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PaqueteSyncDocenteCreateInput = {
    id?: string
    docenteId: string
    paqueteBase64: string
    checksumSha256?: string | null
    schemaVersion?: number
    exportadoEn?: Date | string | null
    desde?: Date | string | null
    periodoId?: string | null
    conteos?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PaqueteSyncDocenteUncheckedCreateInput = {
    id?: string
    docenteId: string
    paqueteBase64: string
    checksumSha256?: string | null
    schemaVersion?: number
    exportadoEn?: Date | string | null
    desde?: Date | string | null
    periodoId?: string | null
    conteos?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PaqueteSyncDocenteUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    paqueteBase64?: StringFieldUpdateOperationsInput | string
    checksumSha256?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: IntFieldUpdateOperationsInput | number
    exportadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    desde?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodoId?: NullableStringFieldUpdateOperationsInput | string | null
    conteos?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PaqueteSyncDocenteUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    paqueteBase64?: StringFieldUpdateOperationsInput | string
    checksumSha256?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: IntFieldUpdateOperationsInput | number
    exportadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    desde?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodoId?: NullableStringFieldUpdateOperationsInput | string | null
    conteos?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PaqueteSyncDocenteCreateManyInput = {
    id?: string
    docenteId: string
    paqueteBase64: string
    checksumSha256?: string | null
    schemaVersion?: number
    exportadoEn?: Date | string | null
    desde?: Date | string | null
    periodoId?: string | null
    conteos?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PaqueteSyncDocenteUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    paqueteBase64?: StringFieldUpdateOperationsInput | string
    checksumSha256?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: IntFieldUpdateOperationsInput | number
    exportadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    desde?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodoId?: NullableStringFieldUpdateOperationsInput | string | null
    conteos?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PaqueteSyncDocenteUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    docenteId?: StringFieldUpdateOperationsInput | string
    paqueteBase64?: StringFieldUpdateOperationsInput | string
    checksumSha256?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: IntFieldUpdateOperationsInput | number
    exportadoEn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    desde?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodoId?: NullableStringFieldUpdateOperationsInput | string | null
    conteos?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type PerfilAlumnoPeriodoIdAlumnoIdCompoundUniqueInput = {
    periodoId: string
    alumnoId: string
  }

  export type PerfilAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrder
    docenteId?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PerfilAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrder
    docenteId?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PerfilAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrder
    docenteId?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type ResultadoAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    totalReactivos?: SortOrder
    aciertos?: SortOrder
    calificacionExamenFinalTexto?: SortOrder
    calificacionParcialTexto?: SortOrder
    calificacionGlobalTexto?: SortOrder
    evaluacionContinuaTexto?: SortOrder
    proyectoTexto?: SortOrder
    politicaId?: SortOrder
    versionPolitica?: SortOrder
    componentesExamen?: SortOrder
    bloqueContinuaDecimal?: SortOrder
    bloqueExamenesDecimal?: SortOrder
    finalDecimal?: SortOrder
    finalRedondeada?: SortOrder
    respuestasDetectadas?: SortOrder
    comparativaRespuestas?: SortOrder
    omrCapturas?: SortOrder
    omrAuditoria?: SortOrder
    banderas?: SortOrder
    pdfComprimidoBase64?: SortOrder
    publicadoEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ResultadoAlumnoAvgOrderByAggregateInput = {
    totalReactivos?: SortOrder
    aciertos?: SortOrder
    versionPolitica?: SortOrder
    bloqueContinuaDecimal?: SortOrder
    bloqueExamenesDecimal?: SortOrder
    finalDecimal?: SortOrder
    finalRedondeada?: SortOrder
  }

  export type ResultadoAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    totalReactivos?: SortOrder
    aciertos?: SortOrder
    calificacionExamenFinalTexto?: SortOrder
    calificacionParcialTexto?: SortOrder
    calificacionGlobalTexto?: SortOrder
    evaluacionContinuaTexto?: SortOrder
    proyectoTexto?: SortOrder
    politicaId?: SortOrder
    versionPolitica?: SortOrder
    componentesExamen?: SortOrder
    bloqueContinuaDecimal?: SortOrder
    bloqueExamenesDecimal?: SortOrder
    finalDecimal?: SortOrder
    finalRedondeada?: SortOrder
    respuestasDetectadas?: SortOrder
    comparativaRespuestas?: SortOrder
    omrCapturas?: SortOrder
    omrAuditoria?: SortOrder
    banderas?: SortOrder
    pdfComprimidoBase64?: SortOrder
    publicadoEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ResultadoAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrder
    matricula?: SortOrder
    nombreCompleto?: SortOrder
    grupo?: SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    totalReactivos?: SortOrder
    aciertos?: SortOrder
    calificacionExamenFinalTexto?: SortOrder
    calificacionParcialTexto?: SortOrder
    calificacionGlobalTexto?: SortOrder
    evaluacionContinuaTexto?: SortOrder
    proyectoTexto?: SortOrder
    politicaId?: SortOrder
    versionPolitica?: SortOrder
    componentesExamen?: SortOrder
    bloqueContinuaDecimal?: SortOrder
    bloqueExamenesDecimal?: SortOrder
    finalDecimal?: SortOrder
    finalRedondeada?: SortOrder
    respuestasDetectadas?: SortOrder
    comparativaRespuestas?: SortOrder
    omrCapturas?: SortOrder
    omrAuditoria?: SortOrder
    banderas?: SortOrder
    pdfComprimidoBase64?: SortOrder
    publicadoEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ResultadoAlumnoSumOrderByAggregateInput = {
    totalReactivos?: SortOrder
    aciertos?: SortOrder
    versionPolitica?: SortOrder
    bloqueContinuaDecimal?: SortOrder
    bloqueExamenesDecimal?: SortOrder
    finalDecimal?: SortOrder
    finalRedondeada?: SortOrder
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type MateriaAlumnoPeriodoIdAlumnoIdMateriaIdCompoundUniqueInput = {
    periodoId: string
    alumnoId: string
    materiaId: string
  }

  export type MateriaAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    materiaId?: SortOrder
    nombre?: SortOrder
    docente?: SortOrder
    estado?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MateriaAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    materiaId?: SortOrder
    nombre?: SortOrder
    docente?: SortOrder
    estado?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MateriaAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    materiaId?: SortOrder
    nombre?: SortOrder
    docente?: SortOrder
    estado?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AgendaAlumnoPeriodoIdAlumnoIdAgendaIdCompoundUniqueInput = {
    periodoId: string
    alumnoId: string
    agendaId: string
  }

  export type AgendaAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    agendaId?: SortOrder
    titulo?: SortOrder
    descripcion?: SortOrder
    fecha?: SortOrder
    tipo?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AgendaAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    agendaId?: SortOrder
    titulo?: SortOrder
    descripcion?: SortOrder
    fecha?: SortOrder
    tipo?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AgendaAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    agendaId?: SortOrder
    titulo?: SortOrder
    descripcion?: SortOrder
    fecha?: SortOrder
    tipo?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AvisoAlumnoPeriodoIdAlumnoIdAvisoIdCompoundUniqueInput = {
    periodoId: string
    alumnoId: string
    avisoId: string
  }

  export type AvisoAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    avisoId?: SortOrder
    titulo?: SortOrder
    mensaje?: SortOrder
    severidad?: SortOrder
    publicadoEn?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AvisoAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    avisoId?: SortOrder
    titulo?: SortOrder
    mensaje?: SortOrder
    severidad?: SortOrder
    publicadoEn?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AvisoAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    avisoId?: SortOrder
    titulo?: SortOrder
    mensaje?: SortOrder
    severidad?: SortOrder
    publicadoEn?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type HistorialAlumnoPeriodoIdAlumnoIdHistorialIdCompoundUniqueInput = {
    periodoId: string
    alumnoId: string
    historialId: string
  }

  export type HistorialAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    historialId?: SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    calificacionTexto?: SortOrder
    aciertos?: SortOrder
    totalReactivos?: SortOrder
    fecha?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type HistorialAlumnoAvgOrderByAggregateInput = {
    aciertos?: SortOrder
    totalReactivos?: SortOrder
  }

  export type HistorialAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    historialId?: SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    calificacionTexto?: SortOrder
    aciertos?: SortOrder
    totalReactivos?: SortOrder
    fecha?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type HistorialAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    historialId?: SortOrder
    folio?: SortOrder
    tipoExamen?: SortOrder
    calificacionTexto?: SortOrder
    aciertos?: SortOrder
    totalReactivos?: SortOrder
    fecha?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type HistorialAlumnoSumOrderByAggregateInput = {
    aciertos?: SortOrder
    totalReactivos?: SortOrder
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type CodigoAccesoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    codigo?: SortOrder
    expiraEn?: SortOrder
    usado?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CodigoAccesoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    codigo?: SortOrder
    expiraEn?: SortOrder
    usado?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CodigoAccesoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    codigo?: SortOrder
    expiraEn?: SortOrder
    usado?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type BoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type EventoUsoAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    sessionId?: SortOrder
    pantalla?: SortOrder
    accion?: SortOrder
    exito?: SortOrder
    duracionMs?: SortOrder
    meta?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EventoUsoAlumnoAvgOrderByAggregateInput = {
    duracionMs?: SortOrder
  }

  export type EventoUsoAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    sessionId?: SortOrder
    pantalla?: SortOrder
    accion?: SortOrder
    exito?: SortOrder
    duracionMs?: SortOrder
    meta?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EventoUsoAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    sessionId?: SortOrder
    pantalla?: SortOrder
    accion?: SortOrder
    exito?: SortOrder
    duracionMs?: SortOrder
    meta?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EventoUsoAlumnoSumOrderByAggregateInput = {
    duracionMs?: SortOrder
  }

  export type BoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type SesionAlumnoCountOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    tokenHash?: SortOrder
    expiraEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SesionAlumnoMaxOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    tokenHash?: SortOrder
    expiraEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SesionAlumnoMinOrderByAggregateInput = {
    id?: SortOrder
    periodoId?: SortOrder
    alumnoId?: SortOrder
    tokenHash?: SortOrder
    expiraEn?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type SolicitudRevisionCountOrderByAggregateInput = {
    id?: SortOrder
    externoId?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrder
    folio?: SortOrder
    numeroPregunta?: SortOrder
    comentario?: SortOrder
    estado?: SortOrder
    solicitadoEn?: SortOrder
    atendidoEn?: SortOrder
    respuestaDocente?: SortOrder
    firmaDocente?: SortOrder
    firmadoEn?: SortOrder
    cerradoEn?: SortOrder
    conformidadAlumno?: SortOrder
    conformidadActualizadaEn?: SortOrder
    origen?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SolicitudRevisionAvgOrderByAggregateInput = {
    numeroPregunta?: SortOrder
  }

  export type SolicitudRevisionMaxOrderByAggregateInput = {
    id?: SortOrder
    externoId?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrder
    folio?: SortOrder
    numeroPregunta?: SortOrder
    comentario?: SortOrder
    estado?: SortOrder
    solicitadoEn?: SortOrder
    atendidoEn?: SortOrder
    respuestaDocente?: SortOrder
    firmaDocente?: SortOrder
    firmadoEn?: SortOrder
    cerradoEn?: SortOrder
    conformidadAlumno?: SortOrder
    conformidadActualizadaEn?: SortOrder
    origen?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SolicitudRevisionMinOrderByAggregateInput = {
    id?: SortOrder
    externoId?: SortOrder
    periodoId?: SortOrder
    docenteId?: SortOrder
    alumnoId?: SortOrder
    examenGeneradoId?: SortOrder
    folio?: SortOrder
    numeroPregunta?: SortOrder
    comentario?: SortOrder
    estado?: SortOrder
    solicitadoEn?: SortOrder
    atendidoEn?: SortOrder
    respuestaDocente?: SortOrder
    firmaDocente?: SortOrder
    firmadoEn?: SortOrder
    cerradoEn?: SortOrder
    conformidadAlumno?: SortOrder
    conformidadActualizadaEn?: SortOrder
    origen?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SolicitudRevisionSumOrderByAggregateInput = {
    numeroPregunta?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type PaqueteSyncDocenteCountOrderByAggregateInput = {
    id?: SortOrder
    docenteId?: SortOrder
    paqueteBase64?: SortOrder
    checksumSha256?: SortOrder
    schemaVersion?: SortOrder
    exportadoEn?: SortOrder
    desde?: SortOrder
    periodoId?: SortOrder
    conteos?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PaqueteSyncDocenteAvgOrderByAggregateInput = {
    schemaVersion?: SortOrder
  }

  export type PaqueteSyncDocenteMaxOrderByAggregateInput = {
    id?: SortOrder
    docenteId?: SortOrder
    paqueteBase64?: SortOrder
    checksumSha256?: SortOrder
    schemaVersion?: SortOrder
    exportadoEn?: SortOrder
    desde?: SortOrder
    periodoId?: SortOrder
    conteos?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PaqueteSyncDocenteMinOrderByAggregateInput = {
    id?: SortOrder
    docenteId?: SortOrder
    paqueteBase64?: SortOrder
    checksumSha256?: SortOrder
    schemaVersion?: SortOrder
    exportadoEn?: SortOrder
    desde?: SortOrder
    periodoId?: SortOrder
    conteos?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PaqueteSyncDocenteSumOrderByAggregateInput = {
    schemaVersion?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableBoolFieldUpdateOperationsInput = {
    set?: boolean | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedBoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type NestedBoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}