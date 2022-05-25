import * as AWS from 'aws-sdk'
import { Channel, saveChannel, saveMessage, timeNowSec } from 'common';
import { Api, TelegramClient } from 'telegram';
import { IterMessagesParams } from 'telegram/client/messages';

const TABLE_CHANNELS = 'Channels';
const INDEX_LAST_CRAWLED = 'LastCrawled';
const DEFAULT_CHANNEL_BATCH_SIZE = 100;
const DEFAULT_MESSAGE_BATCH_SIZE = 100;
const MIN_CRAWL_INTERVAL_SEC = 300;

export type CrawlerOptions = {
    messageBatchSize?: number,
    earliestTsToProcess: number,
}

type StoreMessagesResult = {
    minMessageId: number,
    maxMessageId: number,
    messagesStored: number,
    earliestTsReached: boolean,
}

export class ChannelProcessor {
    private ddbClient: AWS.DynamoDB.DocumentClient;
    private tgClient: TelegramClient;
    private options: CrawlerOptions;

    constructor(ddbCli: AWS.DynamoDB.DocumentClient, tgClient: TelegramClient, options: CrawlerOptions) {
        this.ddbClient = ddbCli;
        this.tgClient = tgClient;
        this.options = options;
    }

    async getChannelBatch(batchSize?: number): Promise<Channel[]> {
        const result = await this.ddbClient.scan({
            TableName: TABLE_CHANNELS,
            Limit: batchSize ?? DEFAULT_CHANNEL_BATCH_SIZE,
            IndexName: INDEX_LAST_CRAWLED,
        }).promise();
        const channels = result.Items as Channel[];
        return channels
            .filter(c => {
                const timePassed = timeNowSec() - c.lastCrawledTs;
                if (timePassed < MIN_CRAWL_INTERVAL_SEC) {
                    console.log(`Channel ${c.id} was last crawled ${timePassed} < ${MIN_CRAWL_INTERVAL_SEC} seconds ago, skipping`);
                    return false;
                }
                return true;
            });
    }

    async processChannel(channel: Channel) {
        console.log(`Processing channel ${channel.id}`);
        let maxMessageId = 0, minMessageId = Infinity;
        let messages: Api.Message[];
        try {
            while (true) {
                const opts: Partial<IterMessagesParams> = {
                    limit: this.options.messageBatchSize ?? DEFAULT_MESSAGE_BATCH_SIZE,
                    minId: channel.lastSeenMessageId ?? 0,
                };
                if (minMessageId < Infinity) {
                    opts.maxId = minMessageId;
                }
                console.log(`Getting messages: ${JSON.stringify(opts)}`);
                messages = await this.tgClient.getMessages(channel.id, opts);
                if (messages.length === 0) {
                    break;
                }
                const result = await this.storeMessages(messages, channel.id);
                maxMessageId = Math.max(maxMessageId, result.maxMessageId);
                minMessageId = result.minMessageId;
                console.log(`Stored ${result.messagesStored} messages from channel ${channel.id}`);
                console.log(`Min message ID = ${minMessageId}, max mesage ID = ${maxMessageId}`);

                channel.lastSeenMessageId = maxMessageId;
                await saveChannel(channel, this.ddbClient);
                if (result.earliestTsReached) {
                    break;
                }
            }
        } finally {
            channel.lastCrawledTs = timeNowSec();
            await saveChannel(channel, this.ddbClient);
        }
    }

    private async storeMessages(messages: Api.Message[], channelId: string): Promise<StoreMessagesResult> {
        const result = {
            earliestTsReached: false,
            messagesStored: 0,
            minMessageId: Infinity,
            maxMessageId: 0,
        };
        for (const m of messages) {
            if (m.date < this.options.earliestTsToProcess) {
                result.earliestTsReached = true;
                break;
            }
            const msg = {
                messageId: m.id.toString(),
                channelId: channelId,
                author: m.postAuthor,
                text: m.text,
            };
            await saveMessage(msg, this.ddbClient);
            result.messagesStored++;
            result.minMessageId = Math.min(result.minMessageId, m.id);
            result.maxMessageId = Math.max(result.maxMessageId, m.id);
        }
        return result;
    }
}