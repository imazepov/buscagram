import * as AWS from 'aws-sdk';
import { getSession, sleep, TELEGRAM_CREDS, timeNowMs } from 'common';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as yargs from 'yargs';
import { ChannelProcessor } from './processor';

const INTERVAL_MS = 5000;
const CHANNEL_BATCH_SIZE = 100;
const dynamoDbClient = new AWS.DynamoDB.DocumentClient({
    endpoint: 'http://home-pc:8066',
});

async function connectTelegram(phoneNumber: string): Promise<TelegramClient> {
    const storedSession = await getSession(phoneNumber, dynamoDbClient);
    if (!storedSession) {
        throw new Error(`Failed to find session for phone number ${phoneNumber}`);
    }
    const session = new StringSession(storedSession.tgSession);
    const client = new TelegramClient(session,
        TELEGRAM_CREDS.apiId,
        TELEGRAM_CREDS.apiHash,
        { requestRetries: 3 });
    await client.connect();
    return client;
}

async function main() {
    const args = yargs.option('phone-number', {
        alias: 'p',
        description: 'Phone number of the Telegram account to use',
        requiresArg: true,
        type: 'string',
    })
        .help()
        .argv;

    if (!args['phone-number']) {
        console.log('Phone number required');
        return;
    }

    const tgClient = await connectTelegram(args['phone-number']);
    const processor = new ChannelProcessor(dynamoDbClient, tgClient, {
        earliestTsToProcess: 1653195832,
    });
    let lastRan = timeNowMs();
    while (true) {
        try {
            const channels = await processor.getChannelBatch(CHANNEL_BATCH_SIZE);
            console.log(`Got ${channels.length} channels`);
            for (const channel of channels) {
                await processor.processChannel(channel);
            }
            console.log(`Processed ${channels.length} channels`);
        } catch (e) {
            console.error(e);
        }
        const timeToWait = INTERVAL_MS - (timeNowMs() - lastRan);
        console.log(`Time now = ${timeNowMs()}, last ran = ${lastRan}, time to wait = ${timeToWait}`);
        if (timeToWait > 0) {
            await sleep(timeToWait);
        }
        lastRan = timeNowMs();
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(-1);
    });
