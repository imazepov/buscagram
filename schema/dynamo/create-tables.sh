#!/bin/sh

if [ -z "${ENDPOINT_URL}" ]; then
    # Local server
    ENDPOINT_URL=http://localhost:8066
fi

if [ "$1" = "--overwrite-all" ]; then
    aws dynamodb delete-table \
        --table-name Messages \
        --endpoint-url $ENDPOINT_URL
    aws dynamodb delete-table \
        --table-name Sessions \
        --endpoint-url $ENDPOINT_URL
    aws dynamodb delete-table \
        --table-name Users \
        --endpoint-url $ENDPOINT_URL
    aws dynamodb delete-table \
        --table-name Channels \
        --endpoint-url $ENDPOINT_URL
fi

aws dynamodb create-table \
    --table-name Messages \
    --attribute-definitions \
        AttributeName=channelId,AttributeType=S \
        AttributeName=messageId,AttributeType=S \
    --key-schema \
        AttributeName=channelId,KeyType=HASH \
        AttributeName=messageId,KeyType=RANGE \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --table-class STANDARD \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url $ENDPOINT_URL

aws dynamodb create-table \
    --table-name Sessions \
    --attribute-definitions \
        AttributeName=phoneNumber,AttributeType=S \
        AttributeName=sessionId,AttributeType=S \
    --key-schema \
        AttributeName=phoneNumber,KeyType=HASH \
    --global-secondary-indexes \
        IndexName=SessionId,KeySchema="[{AttributeName=sessionId,KeyType=HASH}]",Projection="{ProjectionType=ALL}" \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --table-class STANDARD \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url $ENDPOINT_URL

aws dynamodb create-table \
    --table-name Users \
    --attribute-definitions \
        AttributeName=phoneNumber,AttributeType=S \
    --key-schema \
        AttributeName=phoneNumber,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --table-class STANDARD \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url $ENDPOINT_URL

aws dynamodb create-table \
    --table-name Channels \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=lastCrawledTs,AttributeType=N \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        IndexName=LastCrawled,KeySchema="[{AttributeName=id,KeyType=HASH},{AttributeName=lastCrawledTs,KeyType=RANGE}]",Projection="{ProjectionType=ALL}" \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --table-class STANDARD \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url $ENDPOINT_URL
