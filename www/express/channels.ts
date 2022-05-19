import { Channel, ChannelCrawlStatus, getChannel, saveChannel } from 'common';
import { Express } from 'express';
import { StringSession } from 'telegram/sessions';
import { ChannelViewModel, GetMyChannelsRequest, GetMyChannelsResponse, IndexChannelRequest, IndexChannelResponse } from 'web-common';
import { wrapHandler } from './api';
import { DAO } from './dao';
import { UserSession } from './types';
import { connectTelegram, errorResponse } from './util';

export function channelRoutes(app: Express, dao: DAO) {
    app.get('/my_channels', wrapHandler<GetMyChannelsRequest, GetMyChannelsResponse>(GetMyChannelsRequest, async req => {
        try {
            let userSession: UserSession | null = null;
            if (req.sessionID) {
                userSession = await dao.getUserSessionById(req.sessionID);
            }
            if (!userSession) {
                return {
                    code: 401,
                    response: { error: 'Not logged in' },
                };
            }
            const session = new StringSession(userSession.tgSession);
            const tgCli = await connectTelegram(session);
            const dialogs = await tgCli.getDialogs({});
            const channels = dialogs
                .filter(d => d.isChannel)
                .map(d => <ChannelViewModel>{
                    id: d.id?.toString(),
                    name: d.name,
                });
            const indexedChannels = await Promise.all(
                channels.map(c => getChannel(c.id, dao.dynamoCli())));
            console.log(`Got ${indexedChannels.length} indexed channels`);
            const indexedChannelSet = new Set(indexedChannels
                .filter(c => c)
                .map(c => c!.id));
            for (const channel of channels) {
                if (indexedChannelSet.has(channel.id)) {
                    channel.isIndexed = true;
                }
            }
            return {
                code: 200,
                response: {
                    channels: channels,
                },
            };
        } catch (e) {
            console.log(`Failed to get channels for ${req.sessionID}: ${e}`);
            return errorResponse(e);
        }
    }));

    app.post('/index_channel', wrapHandler<IndexChannelRequest, IndexChannelResponse>(IndexChannelRequest, async req => {
        try {
            const existingChannel = await getChannel(req.body.id, dao.dynamoCli());
            if (existingChannel) {
                return {
                    code: 200,
                    response: {
                        alreadyIndexed: true,
                    },
                };
            }
            const channel: Channel = {
                id: req.body.id,
                name: '',
                lastCrawledTs: 0,
                lastSeenMessageId: 0,
                status: ChannelCrawlStatus.ACTIVE,
            };
            await saveChannel(channel, dao.dynamoCli());
            return {
                code: 200,
                response: {
                    alreadyIndexed: false,
                },
            };
        } catch (e) {
            console.log(`Failed to index channel ${req.body.id}: ${e}`);
            return errorResponse(e);
        }
    }));
}
