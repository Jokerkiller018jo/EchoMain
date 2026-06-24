const Module = require('module');
const path = require('path');

const colorsFallback = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
    red: '\x1b[31m',
    blue: '\x1b[36m'
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'mongoose' || id === 'mongodb') {
        return originalRequire.call(this, path.join(__dirname, 'mongoose-postgres'));
    }
    
    // Check for colors/colors module loading and provide fallback if missing
    if (id.endsWith('colors/colors') || id.endsWith('colors/colors.js') || id.includes('UI/colors')) {
        try {
            return originalRequire.apply(this, arguments);
        } catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                return colorsFallback;
            }
            throw e;
        }
    }
    
    return originalRequire.apply(this, arguments);
};

console.log('[HIJACK] Successfully redirected mongoose and mongodb to Postgres DB wrapper.');
