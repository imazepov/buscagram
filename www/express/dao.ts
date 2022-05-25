import * as AWS from 'aws-sdk';
import { UserSession } from './types';

const TABLE_SESSIONS = 'Sessions';

export class DAO {
    private ddbClient: AWS.DynamoDB.DocumentClient;

    constructor(ddbCli: AWS.DynamoDB.DocumentClient) {
        this.ddbClient = ddbCli;
    }

    dynamoCli(): AWS.DynamoDB.DocumentClient {
        return this.ddbClient;
    }

    async getUserSessionById(sessionId: string): Promise<UserSession | null> {
        const params = {
            TableName: TABLE_SESSIONS,
            KeyConditionExpression: 'sessionId = :v',
            ExpressionAttributeValues: {
                ':v': sessionId,
            },
            IndexName: 'SessionId',
        };
        const result = await this.ddbClient.query(params).promise();
        if (!result.Items || result.Items.length === 0) {
            console.log('Session not found in DDB');
            return null;
        }
        return result.Items[0] as UserSession;
    }

    async writeUserSession(session: UserSession) {
        const params = {
            TableName: TABLE_SESSIONS,
            Item: session,
        };
        await this.ddbClient.put(params).promise();
    }
}
