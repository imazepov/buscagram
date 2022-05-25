import { DataSource } from './data';
import { Client } from '@opensearch-project/opensearch';
import { Message, timeNowMs } from 'common';

export class Indexer {
    private indexName: string;
    private batchSize: number;
    private esCli: Client;

    constructor(endpoint: string, indexName: string, batchSize: number) {
        this.indexName = indexName;
        this.batchSize = batchSize;
        this.esCli = new Client({
            node: endpoint,
        });
    }

    private makeDocId(doc: Message): string {
        return `${doc.channelId}:${doc.messageId}`;
    }

    async indexMessages(ds: DataSource): Promise<void> {
        let recordsBatch = await ds.readRecords(this.batchSize)
        while (recordsBatch.length > 0) {
            const now = timeNowMs();
            const operations = recordsBatch.flatMap(doc => [
                { index: { _id: this.makeDocId(doc as Message) } },
                doc,
            ])
            await this.esCli.bulk({
                index: this.indexName,
                refresh: false,
                body: operations,
            });
            console.log(`Indexed batch of ${recordsBatch.length} in ${timeNowMs() - now} ms`);

            recordsBatch = await ds.readRecords(this.batchSize);
        }

        await this.esCli.indices.refresh({
            index: this.indexName,
        });
    }
}
