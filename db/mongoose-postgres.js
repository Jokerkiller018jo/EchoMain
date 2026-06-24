const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

let pool = null;
let isInitialized = false;

// Read config for database URI fallback
let config = {};
try {
    const configPath = path.join(__dirname, '../config.json');
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (e) {
    // Suppress config read error
}

const connectionString = process.env.DATABASE_URL || config.postgresUri || config.mongodbUri || process.env.MONGODB_URI;

function getPgPool() {
    if (!pool) {
        if (!connectionString) {
            throw new Error('[POSTGRES] No connection string provided. Please set DATABASE_URL in .env');
        }
        pool = new Pool({
            connectionString: connectionString,
            ssl: connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }
    return pool;
}

// DDL: Setup single-table document store in PostgreSQL
async function initializeDatabase() {
    if (isInitialized) return;
    const client = await getPgPool().connect();
    try {
        console.log('[POSTGRES] Setting up mongoose_documents table...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS mongoose_documents (
                id SERIAL PRIMARY KEY,
                model_name VARCHAR(255) NOT NULL,
                doc JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Index on model_name
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_mongoose_docs_model_name 
            ON mongoose_documents(model_name);
        `);

        // Unique index for upserts by doc ID
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_mongoose_docs_model_id 
            ON mongoose_documents(model_name, (doc->>'_id'));
        `);

        // Indexes for common query fields
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_mongoose_docs_guild_id 
            ON mongoose_documents ((doc->>'guildId')) 
            WHERE doc->>'guildId' IS NOT NULL;
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_mongoose_docs_server_id 
            ON mongoose_documents ((doc->>'serverId')) 
            WHERE doc->>'serverId' IS NOT NULL;
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_mongoose_docs_user_id 
            ON mongoose_documents ((doc->>'userId')) 
            WHERE doc->>'userId' IS NOT NULL;
        `);

        isInitialized = true;
        console.log('[POSTGRES] Table and indexes verified successfully.');
    } catch (err) {
        console.error('[POSTGRES] Database initialization error:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Helper: Generate a MongoDB-compatible 24-character hexadecimal ObjectId string
function generateMongoId() {
    return crypto.randomBytes(12).toString('hex');
}

// Helpers for nested JSON object manipulation
function getPath(obj, pathStr) {
    if (!obj) return undefined;
    const parts = pathStr.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

function setPath(obj, pathStr, value) {
    if (!obj) return;
    const parts = pathStr.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
}

function unsetPath(obj, pathStr) {
    if (!obj) return;
    const parts = pathStr.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || current[part] === null) return;
        current = current[part];
    }
    delete current[parts[parts.length - 1]];
}

// Helper: Applies MongoDB update object ($set, $inc, $push, $pull, $unset) to doc
function applyUpdate(doc, updateObj) {
    const updated = JSON.parse(JSON.stringify(doc || {}));
    
    for (const key of Object.keys(updateObj || {})) {
        const val = updateObj[key];
        if (key === '$set') {
            for (const pathStr of Object.keys(val)) {
                setPath(updated, pathStr, val[pathStr]);
            }
        } else if (key === '$inc') {
            for (const pathStr of Object.keys(val)) {
                const cur = getPath(updated, pathStr) || 0;
                setPath(updated, pathStr, Number(cur) + Number(val[pathStr]));
            }
        } else if (key === '$push') {
            for (const pathStr of Object.keys(val)) {
                const arr = getPath(updated, pathStr) || [];
                if (Array.isArray(arr)) {
                    if (val[pathStr] && typeof val[pathStr] === 'object' && val[pathStr].$each) {
                        arr.push(...val[pathStr].$each);
                    } else {
                        arr.push(val[pathStr]);
                    }
                    setPath(updated, pathStr, arr);
                }
            }
        } else if (key === '$pull') {
            for (const pathStr of Object.keys(val)) {
                const arr = getPath(updated, pathStr) || [];
                if (Array.isArray(arr)) {
                    const pullVal = val[pathStr];
                    const filtered = arr.filter(item => {
                        if (typeof pullVal === 'object' && pullVal !== null) {
                            return JSON.stringify(item) !== JSON.stringify(pullVal);
                        }
                        return item !== pullVal;
                    });
                    setPath(updated, pathStr, filtered);
                }
            }
        } else if (key === '$unset') {
            for (const pathStr of Object.keys(val)) {
                unsetPath(updated, pathStr);
            }
        } else if (!key.startsWith('$')) {
            setPath(updated, key, val);
        }
    }
    return updated;
}

// Helper: Build SQL WHERE clause from MongoDB-style query
function buildQuerySql(modelName, queryObj, startParamIdx = 2) {
    const where = ['model_name = $1'];
    const params = [modelName];
    let paramIdx = startParamIdx;

    function parseField(key, val) {
        const parts = key.split('.');
        let pathStr = 'doc';
        for (let i = 0; i < parts.length - 1; i++) {
            pathStr += `->'${parts[i]}'`;
        }
        const lastPart = parts[parts.length - 1];
        const fieldAccessor = `${pathStr}->>'${lastPart}'`;

        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
            for (const op of Object.keys(val)) {
                const opVal = val[op];
                if (op === '$gt') {
                    where.push(`(${fieldAccessor})::numeric > $${paramIdx}`);
                    params.push(Number(opVal));
                    paramIdx++;
                } else if (op === '$gte') {
                    where.push(`(${fieldAccessor})::numeric >= $${paramIdx}`);
                    params.push(Number(opVal));
                    paramIdx++;
                } else if (op === '$lt') {
                    where.push(`(${fieldAccessor})::numeric < $${paramIdx}`);
                    params.push(Number(opVal));
                    paramIdx++;
                } else if (op === '$lte') {
                    where.push(`(${fieldAccessor})::numeric <= $${paramIdx}`);
                    params.push(Number(opVal));
                    paramIdx++;
                } else if (op === '$ne') {
                    where.push(`(${fieldAccessor}) IS DISTINCT FROM $${paramIdx}`);
                    params.push(String(opVal));
                    paramIdx++;
                } else if (op === '$in') {
                    if (Array.isArray(opVal)) {
                        where.push(`(${fieldAccessor}) = ANY($${paramIdx}::text[])`);
                        params.push(opVal.map(String));
                        paramIdx++;
                    }
                }
            }
        } else {
            if (val === null) {
                where.push(`(${fieldAccessor}) IS NULL`);
            } else {
                where.push(`(${fieldAccessor}) = $${paramIdx}`);
                params.push(String(val));
                paramIdx++;
            }
        }
    }

    for (const key of Object.keys(queryObj || {})) {
        if (key === '$or' && Array.isArray(queryObj[key])) {
            const orClauses = [];
            for (const subQuery of queryObj[key]) {
                const subResult = buildQuerySql(modelName, subQuery, paramIdx);
                const subFilters = subResult.whereClause.split(' AND ').slice(1);
                if (subFilters.length > 0) {
                    orClauses.push(`(${subFilters.join(' AND ')})`);
                }
                params.push(...subResult.params.slice(1));
                paramIdx = subResult.nextParamIdx;
            }
            if (orClauses.length > 0) {
                where.push(`(${orClauses.join(' OR ')})`);
            }
        } else if (key === '$and' && Array.isArray(queryObj[key])) {
            for (const subQuery of queryObj[key]) {
                const subResult = buildQuerySql(modelName, subQuery, paramIdx);
                const subFilters = subResult.whereClause.split(' AND ').slice(1);
                if (subFilters.length > 0) {
                    where.push(`(${subFilters.join(' AND ')})`);
                }
                params.push(...subResult.params.slice(1));
                paramIdx = subResult.nextParamIdx;
            }
        } else {
            parseField(key, queryObj[key]);
        }
    }

    return { 
        whereClause: where.join(' AND '), 
        params,
        nextParamIdx: paramIdx 
    };
}

// Mongoose Mock: VirtualType helper
class VirtualType {
    constructor(name) {
        this.name = name;
        this.getter = null;
        this.setter = null;
    }
    get(fn) {
        this.getter = fn;
        return this;
    }
    set(fn) {
        this.setter = fn;
        return this;
    }
}

// Mongoose Mock: Schema Class
class Schema {
    constructor(definition, options) {
        this.definition = definition || {};
        this.options = options || {};
        this.statics = {};
        this.methods = {};
        this.paths = {};
        this.virtuals = {};
        this._preHooks = {};
        this._postHooks = {};
        this._parseDefinition(this.definition);
    }
    
    _parseDefinition(def, prefix = '') {
        for (const key of Object.keys(def || {})) {
            const val = def[key];
            const pathStr = prefix ? `${prefix}.${key}` : key;
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                if (val.type) {
                    this.paths[pathStr] = val.type;
                } else {
                    this._parseDefinition(val, pathStr);
                }
            } else {
                this.paths[pathStr] = val;
            }
        }
    }
    
    virtual(name) {
        if (!this.virtuals[name]) {
            this.virtuals[name] = new VirtualType(name);
        }
        return this.virtuals[name];
    }

    plugin(fn, options) {
        if (typeof fn === 'function') {
            fn(this, options);
        }
        return this;
    }

    pre(hookName, fn) {
        if (!this._preHooks[hookName]) {
            this._preHooks[hookName] = [];
        }
        this._preHooks[hookName].push(fn);
        return this;
    }

    post(hookName, fn) {
        if (!this._postHooks[hookName]) {
            this._postHooks[hookName] = [];
        }
        this._postHooks[hookName].push(fn);
        return this;
    }
    
    index(fields, options) {
        // Handled dynamically or via general database indexing
    }
}

// Mongoose Mock: Query Builder Class
class Query {
    constructor(model, filter, op, update, options) {
        this.model = model;
        this.filter = filter || {};
        this.op = op;
        this.update = update;
        this.options = options || {};
        this._sort = null;
        this._skip = 0;
        this._limit = null;
        this._lean = false;
        this._select = null;
    }
    
    sort(s) { this._sort = s; return this; }
    skip(s) { this._skip = s; return this; }
    limit(l) { this._limit = l; return this; }
    lean() { this._lean = true; return this; }
    select(s) { this._select = s; return this; }
    
    then(resolve, reject) {
        return this.exec().then(resolve, reject);
    }
    
    async exec() {
        const pool = getPgPool();
        const modelName = this.model.modelName;
        
        const { whereClause, params } = buildQuerySql(modelName, this.filter);
        
        if (this.op === 'find') {
            let sql = `SELECT doc FROM mongoose_documents WHERE ${whereClause}`;
            
            if (this._sort) {
                const sortClauses = [];
                const sortKeys = typeof this._sort === 'string' ? this._sort.split(' ') : Object.keys(this._sort);
                
                for (let k of sortKeys) {
                    let dir = 'ASC';
                    if (typeof this._sort === 'string') {
                        if (k.startsWith('-')) {
                            dir = 'DESC';
                            k = k.substring(1);
                        }
                    } else {
                        dir = this._sort[k] === -1 ? 'DESC' : 'ASC';
                    }
                    
                    const type = this.model.schema?.paths[k];
                    let expr = `doc->>'${k}'`;
                    if (type === Number) {
                        expr = `(doc->>'${k}')::numeric`;
                    } else if (type === Date) {
                        expr = `(doc->>'${k}')::timestamp`;
                    }
                    sortClauses.push(`${expr} ${dir}`);
                }
                if (sortClauses.length > 0) {
                    sql += ` ORDER BY ${sortClauses.join(', ')}`;
                }
            }
            
            if (this._limit !== null) {
                sql += ` LIMIT ${this._limit}`;
            }
            if (this._skip > 0) {
                sql += ` OFFSET ${this._skip}`;
            }
            
            const res = await pool.query(sql, params);
            const docs = res.rows.map(row => row.doc);
            
            if (this._lean) return docs;
            return docs.map(doc => new this.model(doc));
        }
        
        if (this.op === 'findOne') {
            let sql = `SELECT doc FROM mongoose_documents WHERE ${whereClause} LIMIT 1`;
            const res = await pool.query(sql, params);
            if (res.rows.length === 0) return null;
            
            const doc = res.rows[0].doc;
            if (this._lean) return doc;
            return new this.model(doc);
        }
        
        if (this.op === 'findOneAndUpdate') {
            let sql = `SELECT id, doc FROM mongoose_documents WHERE ${whereClause} LIMIT 1`;
            const res = await pool.query(sql, params);
            
            let id = null;
            let doc = null;
            if (res.rows.length > 0) {
                id = res.rows[0].id;
                doc = res.rows[0].doc;
            }
            
            if (!doc) {
                if (this.options.upsert) {
                    const newDoc = applyUpdate({}, this.update);
                    for (const k of Object.keys(this.filter)) {
                        if (!k.startsWith('$') && !k.includes('.')) {
                            if (newDoc[k] === undefined) newDoc[k] = this.filter[k];
                        }
                    }
                    const inst = new this.model(newDoc);
                    await inst.save();
                    return this.options.new ? inst : null;
                }
                return null;
            }
            
            const updatedDoc = applyUpdate(doc, this.update);
            const inst = new this.model(updatedDoc);
            
            if (this.model.schema && this.model.schema.options.timestamps) {
                inst._doc.updatedAt = new Date();
            }
            
            await pool.query(
                `UPDATE mongoose_documents SET doc = $1, updated_at = NOW() WHERE id = $2`,
                [inst._doc, id]
            );
            
            return this.options.new ? inst : new this.model(doc);
        }
        
        if (this.op === 'deleteOne') {
            let sql = `SELECT id FROM mongoose_documents WHERE ${whereClause} LIMIT 1`;
            const res = await pool.query(sql, params);
            if (res.rows.length === 0) return { deletedCount: 0 };
            
            const id = res.rows[0].id;
            await pool.query(`DELETE FROM mongoose_documents WHERE id = $1`, [id]);
            return { deletedCount: 1 };
        }
        
        if (this.op === 'deleteMany') {
            let sql = `DELETE FROM mongoose_documents WHERE ${whereClause}`;
            const res = await pool.query(sql, params);
            return { deletedCount: res.rowCount };
        }
        
        if (this.op === 'countDocuments') {
            let sql = `SELECT COUNT(*) FROM mongoose_documents WHERE ${whereClause}`;
            const res = await pool.query(sql, params);
            return parseInt(res.rows[0].count, 10);
        }
    }
}

// Mongoose Mock: Base Model Class
class PostgresModel {
    constructor(data) {
        this._doc = { ...data };
        
        // Apply default values from Schema
        const schema = this.constructor.schema;
        if (schema) {
            for (const pathStr of Object.keys(schema.paths)) {
                const def = schema.definition[pathStr];
                if (def && typeof def === 'object' && def.default !== undefined) {
                    if (getPath(this._doc, pathStr) === undefined) {
                        const defVal = typeof def.default === 'function' ? def.default() : def.default;
                        setPath(this._doc, pathStr, defVal);
                    }
                }
            }
        }
        
        // Bind instance methods
        if (schema && schema.methods) {
            for (const name of Object.keys(schema.methods)) {
                this[name] = schema.methods[name].bind(this);
            }
        }
        
        // Return a proxy that directs reads and writes to the inner _doc object, handling virtual getters/setters
        return new Proxy(this, {
            get: (target, prop) => {
                if (prop in target) return target[prop];
                if (prop === 'id' || prop === '_id') return target._doc._id || target._doc.id;
                if (prop === 'toObject' || prop === 'toJSON') {
                    return () => JSON.parse(JSON.stringify(target._doc));
                }
                
                // Virtual Getter logic
                const virtual = schema && schema.virtuals[prop];
                if (virtual && virtual.getter) {
                    return virtual.getter.call(target);
                }
                
                return getPath(target._doc, prop);
            },
            set: (target, prop, value) => {
                // Virtual Setter logic
                const virtual = schema && schema.virtuals[prop];
                if (virtual && virtual.setter) {
                    virtual.setter.call(target, value);
                    return true;
                }
                
                if (prop in target) {
                    target[prop] = value;
                } else {
                    setPath(target._doc, prop, value);
                }
                return true;
            }
        });
    }

    markModified(pathStr) {
        // No-op (not needed for full-replacement upserts)
    }

    async save() {
        const modelName = this.constructor.modelName;
        const schema = this.constructor.schema;
        
        // Run Pre hooks (e.g. pre('save'))
        if (schema && schema._preHooks && schema._preHooks['save']) {
            for (const fn of schema._preHooks['save']) {
                if (fn.length > 0) { // Takes next callback
                    await new Promise((resolve, reject) => {
                        fn.call(this, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                } else {
                    await fn.call(this);
                }
            }
        }
        
        if (schema && schema.options.timestamps) {
            const now = new Date();
            if (!this._doc.createdAt) this._doc.createdAt = now;
            this._doc.updatedAt = now;
        }
        
        if (!this._doc._id) {
            this._doc._id = generateMongoId();
        }
        
        const pool = getPgPool();
        await pool.query(
            `INSERT INTO mongoose_documents (model_name, doc) 
             VALUES ($1, $2) 
             ON CONFLICT (model_name, (doc->>'_id')) 
             DO UPDATE SET doc = EXCLUDED.doc, updated_at = NOW()`,
            [modelName, this._doc]
        );
        
        // Run Post hooks (e.g. post('save'))
        if (schema && schema._postHooks && schema._postHooks['save']) {
            for (const fn of schema._postHooks['save']) {
                fn.call(this);
            }
        }
        
        return this;
    }

    // Static CRUD functions
    static find(query) {
        return new Query(this, query, 'find');
    }
    static findOne(query) {
        return new Query(this, query, 'findOne');
    }
    static findOneAndUpdate(query, update, options) {
        return new Query(this, query, 'findOneAndUpdate', update, options);
    }
    static deleteOne(query) {
        return new Query(this, query, 'deleteOne');
    }
    static deleteMany(query) {
        return new Query(this, query, 'deleteMany');
    }
    static countDocuments(query) {
        return new Query(this, query, 'countDocuments');
    }
    static async create(data) {
        const inst = new this(data);
        return await inst.save();
    }
    static async insertMany(arr) {
        const results = [];
        for (const item of arr) {
            results.push(await this.create(item));
        }
        return results;
    }
}

// Registry for models
const modelsRegistry = {};

// Mongoose Connection Event Emitter
class MongooseConnection extends EventEmitter {
    constructor() {
        super();
        this.db = {
            admin: () => ({
                ping: async () => true
            })
        };
    }
}
const connectionInstance = new MongooseConnection();

const mongooseMock = {
    Schema,
    Types: {
        ObjectId: class {
            constructor(id) {
                this.id = id || generateMongoId();
            }
            toString() {
                return this.id;
            }
        }
    },
    model: function (modelName, schema) {
        if (!schema) {
            const registered = modelsRegistry[modelName];
            if (!registered) throw new Error(`Model '${modelName}' is not defined.`);
            return registered;
        }

        const ModelClass = class extends PostgresModel {};
        ModelClass.modelName = modelName;
        ModelClass.schema = schema;

        // Copy static methods from Schema
        if (schema.statics) {
            for (const name of Object.keys(schema.statics)) {
                ModelClass[name] = schema.statics[name].bind(ModelClass);
            }
        }

        modelsRegistry[modelName] = ModelClass;
        return ModelClass;
    },
    connect: async function (uri) {
        await initializeDatabase();
        connectionInstance.emit('connected');
        connectionInstance.emit('open');
        return {
            connection: connectionInstance
        };
    },
    connection: connectionInstance,
    set: function(option, val) {
        // No-op for Mongoose global configuration
    }
};

// MongoClient Mock (routes collection calls to same table)
class CollectionMock {
    constructor(name) {
        this.name = name;
        this.modelName = `collection_${name}`;
        this.model = mongooseMock.model(this.modelName, new Schema({}));
    }
    
    async findOne(query) {
        const res = await new Query(this.model, query, 'findOne').exec();
        return res ? res.toObject() : null;
    }
    
    async insertOne(doc) {
        if (!doc._id) doc._id = generateMongoId();
        const inst = new this.model(doc);
        await inst.save();
        return { insertedId: doc._id };
    }
    
    async updateOne(query, update, options = {}) {
        const res = await new Query(this.model, query, 'findOneAndUpdate', update, { upsert: options.upsert, new: true }).exec();
        return { modifiedCount: res ? 1 : 0, upsertedCount: (options.upsert && res) ? 1 : 0 };
    }
    
    async deleteOne(query) {
        const res = await new Query(this.model, query, 'deleteOne').exec();
        return { deletedCount: res.deletedCount };
    }
    
    find(query) {
        const q = new Query(this.model, query, 'find').lean();
        return {
            toArray: async () => {
                return await q.exec();
            }
        };
    }
}

class DbMock {
    collection(name) {
        return new CollectionMock(name);
    }
}

class MongoClientMock {
    constructor(uri) {
        this.uri = uri;
    }
    async connect() {
        await initializeDatabase();
        return this;
    }
    db(name) {
        return new DbMock();
    }
}

module.exports = {
    // Mongoose Exports
    Schema,
    Types: mongooseMock.Types,
    model: mongooseMock.model,
    connect: mongooseMock.connect,
    connection: mongooseMock.connection,
    set: mongooseMock.set,
    
    // MongoClient Exports
    MongoClient: MongoClientMock,
    
    // Unified DB Connection triggers
    connectToDatabase: async () => {
        await initializeDatabase();
    }
};
