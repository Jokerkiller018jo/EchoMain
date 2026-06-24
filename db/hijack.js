const Module = require('module');
const path = require('path');

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'mongoose' || id === 'mongodb') {
        return originalRequire.call(this, path.join(__dirname, 'mongoose-postgres'));
    }
    return originalRequire.apply(this, arguments);
};

console.log('[HIJACK] Successfully redirected mongoose and mongodb to Postgres DB wrapper.');
