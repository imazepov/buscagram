import express, { RequestHandler } from 'express';
import { ApiRequest, ApiResponse, ErrorResponse } from 'web-common';

interface TypedRequest<T extends ApiRequest> extends express.Request {
    body: T;
}

export interface TypedResponse<T extends ApiResponse> extends express.Response {
    body: T;
}

export interface HandlerResult<R extends ApiResponse> {
    code: number;
    response: R | ErrorResponse;
}

export function wrapHandler<Rq extends ApiRequest, Rs extends ApiResponse>(
    reqType: new() => Rq,
    handler: (req: TypedRequest<Rq>) => Promise<HandlerResult<Rs>>): RequestHandler {
    return async (req: express.Request, res: express.Response) => {
        const typedReq = new reqType();
        Object.assign(typedReq, req.body);
        const errors = await typedReq.validate();
        if (errors && errors.length > 0) {
            res.status(400).json({ error: errors[0] });
            return;
        }

        req.body = typedReq;
        const result = await handler(req);
        res.status(result.code).json(result.response);
    };
}
