import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"

const REGION = process.env["AWS_REGION"] ?? "us-east-2"
const ENDPOINT = process.env["DYNAMO_ENDPOINT"] // Set for local dev (DynamoDB Local)

let _client: DynamoDBDocumentClient | undefined

/**
 * Returns a singleton DynamoDB Document Client.
 * Uses DynamoDB Local if DYNAMO_ENDPOINT is set (for local dev).
 */
export function getDocClient(): DynamoDBDocumentClient {
  if (_client) return _client

  const raw = new DynamoDBClient({
    region: REGION,
    ...(ENDPOINT && { endpoint: ENDPOINT }),
  })

  _client = DynamoDBDocumentClient.from(raw, {
    marshallOptions: {
      // Remove undefined attributes from items — keeps DynamoDB items clean
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  })

  return _client
}
