import { sleep, timeNowMs } from 'common';
import { DynamoDataSource } from './data';
import { Indexer } from './indexer';
import * as yargs from 'yargs';

const DEFAULT_INTERVAL_MS = 300000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_INDEX_NAME = 'messages';

async function main() {
    const args = yargs
        .option('interval-ms', {
            alias: 'i',
            description: 'How often to build the index (in ms)',
            requiresArg: true,
            type: 'number',
            default: DEFAULT_INTERVAL_MS,
        })
        .option('batch-size', {
            alias: 'b',
            description: 'How many messages to index in a single batch',
            requiresArg: true,
            type: 'number',
            default: DEFAULT_BATCH_SIZE,
        })
        .option('ddb-endpoint', {
            alias: 'd',
            description: 'DynamoDB endpoint to use',
            requiresArg: true,
            type: 'string',
        })
        .option('es-endpoint', {
            alias: 'e',
            description: 'ElasticSearch endpoint to use',
            requiresArg: true,
            type: 'string',
        })
        .option('es-index-name', {
            alias: 'n',
            description: 'ElasticSearch index name',
            requiresArg: true,
            type: 'string',
            default: DEFAULT_INDEX_NAME,
        })
        .help()
        .argv;

    if (!args['es-endpoint']) {
        console.log('ElasticSearch endpoint required');
        return;
    }

    if (!args['ddb-endpoint']) {
        console.log('DynamoDB endpoint required');
        return;
    }

    const indexer = new Indexer(args['es-endpoint'], args['es-index-name'], args['batch-size']);
    let lastRan = Date.now();
    while (true) {
        const dataSource = new DynamoDataSource(args['ddb-endpoint']);
        await indexer.indexMessages(dataSource);

        const timeToWait = args['interval-ms'] - (timeNowMs() - lastRan);
        console.log(`Time now = ${timeNowMs()}, last ran = ${lastRan}, time to wait = ${timeToWait}`);
        if (timeToWait > 0) {
            await sleep(timeToWait);
        }
        lastRan = Date.now();
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(-1);
    });
