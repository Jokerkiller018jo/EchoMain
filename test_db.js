// require the hijacker at the very top
require('./db/hijack');

const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

async function main() {
    console.log('=== STARTING POSTGRES ADAPTER TEST ===');
    
    // Connect
    console.log('1. Connecting to DB...');
    require('dotenv').config();
    const fs = require('fs');
    const path = require('path');
    
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    } catch (e) {}

    const uri = process.env.DATABASE_URL || config.postgresUri || config.mongodbUri || process.env.MONGODB_URI;
    
    if (!uri) {
        console.error('❌ Error: No database URI found. Please configure DATABASE_URL in your .env or postgresUri in config.json');
        return;
    }

    console.log('Connecting to database...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully!');

    // Test Mongoose Model
    console.log('\n2. Defining Test Schema...');
    const testSchema = new mongoose.Schema({
        serverId: { type: String, required: true },
        name: String,
        score: { type: Number, default: 0 },
        tags: [String],
        nested: {
            flag: { type: Boolean, default: true }
        }
    });

    testSchema.methods.incrementScore = function() {
        this.score += 10;
        return this.save();
    };

    testSchema.statics.findByServer = function(serverId) {
        return this.findOne({ serverId });
    };

    const TestModel = mongoose.model('TestModel', testSchema);

    // Clean old tests
    await TestModel.deleteMany({ serverId: 'test_server_123' });

    // Create & Save
    console.log('3. Creating test document...');
    const doc = new TestModel({
        serverId: 'test_server_123',
        name: 'Echo Test',
        score: 5,
        tags: ['bot', 'testing'],
        nested: { flag: false }
    });
    
    await doc.save();
    console.log('✅ Document saved! Generated ID:', doc.id);

    // FindOne and methods
    console.log('4. Testing query and custom methods...');
    const found = await TestModel.findByServer('test_server_123');
    if (!found) {
        throw new Error('Could not find saved document!');
    }
    console.log('Found document name:', found.name);
    console.log('Initial score (expected 5):', found.score);
    console.log('Nested flag (expected false):', found.nested.flag);

    await found.incrementScore();
    const updated = await TestModel.findByServer('test_server_123');
    console.log('Updated score (expected 15):', updated.score);
    if (updated.score !== 15) throw new Error('Increment method failed!');

    // Test operator queries
    console.log('5. Testing operators ($gt)...');
    const highScores = await TestModel.find({ score: { $gt: 10 } });
    console.log('Count of docs with score > 10 (expected 1):', highScores.length);
    if (highScores.length !== 1) throw new Error('Operator query failed!');

    // Test findOneAndUpdate
    console.log('6. Testing findOneAndUpdate...');
    await TestModel.findOneAndUpdate(
        { serverId: 'test_server_123' },
        { $set: { name: 'Echo Updated' }, $inc: { score: 5 } }
    );
    const postUpdate = await TestModel.findByServer('test_server_123');
    console.log('Name after update (expected "Echo Updated"):', postUpdate.name);
    console.log('Score after update (expected 20):', postUpdate.score);
    if (postUpdate.name !== 'Echo Updated' || postUpdate.score !== 20) {
        throw new Error('findOneAndUpdate failed!');
    }

    // Test native MongoDB Client Mock
    console.log('\n7. Testing Native MongoClient Mock...');
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('discord-bot');
    const col = db.collection('test_native');

    await col.deleteOne({ guildId: '999' });
    await col.insertOne({ guildId: '999', val: 'Native test content' });
    const nativeDoc = await col.findOne({ guildId: '999' });
    console.log('Found Native doc val:', nativeDoc.val);
    if (nativeDoc.val !== 'Native test content') throw new Error('Native insertOne/findOne failed!');

    await col.updateOne({ guildId: '999' }, { $set: { val: 'Updated native content' } });
    const nativeDoc2 = await col.findOne({ guildId: '999' });
    console.log('Updated Native doc val (expected "Updated native content"):', nativeDoc2.val);
    if (nativeDoc2.val !== 'Updated native content') throw new Error('Native updateOne failed!');

    // Clean up
    console.log('\n8. Cleaning up test data...');
    await TestModel.deleteMany({ serverId: 'test_server_123' });
    await col.deleteOne({ guildId: '999' });
    console.log('✅ Cleanup complete!');

    console.log('\n=== ALL DB TESTS PASSED SUCCESSFULLY! ===');
}

main().catch(err => {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
});
