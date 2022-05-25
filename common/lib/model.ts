import * as AWS from 'aws-sdk';

type DynamoClient = AWS.DynamoDB.DocumentClient;

const TABLE_MESSAGES = 'Messages',
    TABLE_CHANNELS = 'Channels',
    TABLE_USERS = 'Users',
    TABLE_SESSIONS = 'Sessions';

export type Message = {
    messageId: string,
    channelId: string,
    author: string,
    text: string,
}

export enum ChannelCrawlStatus {
    ACTIVE = 0,
    PAUSED = 1,
    ARCHIVED = 2,
}

export type Channel = {
    id: string,
    name: string,
    status: ChannelCrawlStatus,
    lastCrawledTs: number,
    lastSeenMessageId: number,
}

export type User = {
    phoneNumber: string,
    channels: string[],
    lastCrawledTs: number,
}

export type Session = {
    phoneNumber: string,
    sessionId: string,
    tgSession: string,
}

export async function getChannel(id: string, ddbCli: DynamoClient): Promise<Channel | null> {
    const params = {
        TableName: TABLE_CHANNELS,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': id,
        },
    };
    const result = await ddbCli.query(params).promise();
    return (result.Items && result.Items.length > 0)
        ? result.Items[0] as Channel
        : null;
}

export async function saveChannel(channel: Channel, ddbCli: DynamoClient) {
    const params = {
        TableName: TABLE_CHANNELS,
        Item: channel,
    };
    await ddbCli.put(params).promise();
}

export async function saveMessage(msg: Message, ddbCli: DynamoClient) {
    const params = {
        TableName: TABLE_MESSAGES,
        Item: msg,
    };
    await ddbCli.put(params).promise();
}

export async function getSession(
    phoneNumber: string,
    ddbCli: DynamoClient): Promise<Session> {
    const params = {
        TableName: TABLE_SESSIONS,
        Key: {
            'phoneNumber': phoneNumber,
        },
    };
    const result = await ddbCli.get(params).promise();
    return result.Item as Session;
}
