import * as AWS from 'aws-sdk';
import { getSession, sleep, TELEGRAM_CREDS, timeNowMs } from 'common';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as yargs from 'yargs';
import { ChannelProcessor } from './processor';

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_CHANNEL_BATCH_SIZE = 100;

async function connectTelegram(phoneNumber: string, ddbCli: AWS.DynamoDB.DocumentClient): Promise<TelegramClient> {
    const storedSession = await getSession(phoneNumber, ddbCli);
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
    const args = yargs
        .option('phone-number', {
            alias: 'p',
            description: 'Phone number of the Telegram account to use',
            requiresArg: true,
            type: 'string',
        })
        .option('interval-ms', {
            alias: 'i',
            description: 'How often to fetch messages from channels (in ms)',
            requiresArg: true,
            type: 'number',
            default: DEFAULT_INTERVAL_MS,
        })
        .option('channel-batch-size', {
            alias: 'b',
            description: 'How many channels to process in one go',
            requiresArg: true,
            type: 'number',
            default: DEFAULT_CHANNEL_BATCH_SIZE,
        })
        .option('ddb-endpoint', {
            alias: 'd',
            description: 'DynamoDB endpoint to use',
            requiresArg: true,
            type: 'string',
        })
        .help()
        .argv;

    if (!args['phone-number']) {
        console.log('Phone number required');
        return;
    }

    if (!args['ddb-endpoint']) {
        console.log('DynamoDB endpoint required');
        return;
    }

    const dynamoDbClient = new AWS.DynamoDB.DocumentClient({
        endpoint: args['ddb-endpoint'],
    });
    const tgClient = await connectTelegram(args['phone-number'], dynamoDbClient);
    const processor = new ChannelProcessor(dynamoDbClient, tgClient, {
        earliestTsToProcess: 1653195832,
    });
    let lastRan = timeNowMs();
    while (true) {
        try {
            const channels = await processor.getChannelBatch(args['channel-batch-size']);
            console.log(`Got ${channels.length} channels`);
            for (const channel of channels) {
                await processor.processChannel(channel);
            }
            console.log(`Processed ${channels.length} channels`);
        } catch (e) {
            console.error(e);
        }
        const timeToWait = args['interval-ms'] - (timeNowMs() - lastRan);
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
