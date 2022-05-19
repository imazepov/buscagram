import { IsNotEmpty, Matches, validate } from 'class-validator';

export abstract class ApiRequest {
    async validate(): Promise<string[]> {
        const errs = await validate(this);
        return errs.map(err => err.toString());
    }
}

export abstract class ApiResponse {
}

export interface ErrorResponse {
    error: string;
}

const PHONE_NUMBER_REGEX = /^\+?[0-9]{7,16}$/;

export class SendCodeRequest extends ApiRequest {
    @Matches(PHONE_NUMBER_REGEX)
    phoneNumber: string;
}

export class SendCodeResponse extends ApiResponse {
    phoneCodeHash: string;
    isCodeInApp: boolean;
    session: string;
}

export class SignInRequest extends ApiRequest {
    @Matches(PHONE_NUMBER_REGEX)
    phoneNumber: string;

    @IsNotEmpty()
    phoneCodeHash: string;

    @IsNotEmpty()
    phoneCode: string;

    @IsNotEmpty()
    session: string;
}

export class SignInResponse extends ApiResponse {
    firstName: string;
    lastName: string;
}

export class CurrentUserRequest extends ApiRequest {
}

export class CurrentUserResponse extends ApiResponse {
    loggedIn: boolean;
    firstName?: string;
    lastName?: string;
}

export class GetMyChannelsRequest extends ApiRequest {
}

export type ChannelViewModel = {
    id: string,
    name: string,
    isIndexed: boolean,
}

export class GetMyChannelsResponse extends ApiResponse {
    channels: ChannelViewModel[];
}

export class IndexChannelRequest extends ApiRequest {
    id: string;
}

export class IndexChannelResponse extends ApiResponse {
    alreadyIndexed: boolean;
}
