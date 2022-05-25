import * as AWS from 'aws-sdk';

export type Record = any;

export interface DataSource {
    readRecords(maxToRead: number): Promise<Record[]>;
}

const TABLE_MESSAGES = 'Messages';

export class DynamoDataSource implements DataSource {
    private ddbClient: AWS.DynamoDB.DocumentClient;
    private lastKeyRead: AWS.DynamoDB.DocumentClient.Key;
    private started: boolean;

    constructor(endpoint: string) {
        this.ddbClient = new AWS.DynamoDB.DocumentClient({
            endpoint: endpoint,
        });
    }

    async readRecords(maxToRead: number): Promise<any[]> {
        if (this.started && !this.lastKeyRead) {
            return [];
        }
        this.started = true;
        console.log(`Reading DDB starting with key ${this.lastKeyRead}`);
        const result = await this.ddbClient.scan({
            TableName: TABLE_MESSAGES,
            Limit: maxToRead,
            ExclusiveStartKey: this.lastKeyRead,
        }).promise();
        this.lastKeyRead = result.LastEvaluatedKey;
        return result.Items;
    }
}