import { sleep, timeNowMs } from 'common';
import { DynamoDataSource } from './data';
import { Indexer } from './indexer';

const INTERVAL_MS = 300000;
const BATCH_SIZE = 100;
const INDEX_MESSAGES = 'messages';
const ES_ENDPOINT = 'http://home-pc:9200';
const DDB_ENDPOINT = 'http://home-pc:8066';

async function main() {
    const indexer = new Indexer(ES_ENDPOINT, INDEX_MESSAGES, BATCH_SIZE);
    let lastRan = Date.now();
    while (true) {
        const dataSource = new DynamoDataSource(DDB_ENDPOINT);
        await indexer.indexMessages(dataSource);

        const timeToWait = INTERVAL_MS - (timeNowMs() - lastRan);
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
