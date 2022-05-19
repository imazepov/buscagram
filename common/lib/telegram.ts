import * as AWS from 'aws-sdk';
import { getSession } from './model';
import { TelegramClient } from 'telegram';
import { StringSession, Session } from 'telegram/sessions';

export const TELEGRAM_CREDS = {
    apiId: 12206910,
    apiHash: '600710cc3c5ee8e762d6718ffb3f9736',
};
