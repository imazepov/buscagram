PUT /messages
{
    "mappings": {
        "dynamic": false,
        "properties": {
            "id": {
                "type": "keyword"
            },
            "author_id": {
                "type": "keyword"
            },
            "channel_id": {
                "type": "keyword"
            },
            "text": {
                "type": "text"
            }
        }
    },
    "settings": {
        "index": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    }
}