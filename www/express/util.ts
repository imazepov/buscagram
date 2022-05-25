import { TELEGRAM_CREDS } from 'common';
import { TelegramClient } from 'telegram';
import { RPCError } from 'telegram/errors';
import { Session } from 'telegram/sessions';
import { ApiResponse } from 'web-common';
import { HandlerResult } from './api';

export function errorResponse<T extends ApiResponse>(e): HandlerResult<T> {
    return e instanceof RPCError
        ? {
            code: e.code ?? 500,
            response: { error: 'Telegram API error: ' + e.errorMessage },
        }
        : {
            code: 500,
            response: { error: 'Internal error' },
        };
}

export async function connectTelegram(session: Session): Promise<TelegramClient> {
    const client = new TelegramClient(session,
        TELEGRAM_CREDS.apiId,
        TELEGRAM_CREDS.apiHash,
        { requestRetries: 3 });
    await client.connect();
    return client;
}
