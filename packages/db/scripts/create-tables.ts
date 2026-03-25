import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb'

const client = new DynamoDBClient({
  region: process.env['AWS_REGION'] ?? 'us-east-2',
  ...(process.env['DYNAMO_ENDPOINT'] && { endpoint: process.env['DYNAMO_ENDPOINT'] }),
})

const COMPANIES_TABLE = process.env['DYNAMO_TABLE_NAME'] ?? 'yc-companies'
const METADATA_TABLE = process.env['DYNAMO_METADATA_TABLE_NAME'] ?? 'yc-metadata'

async function createTable(cmd: CreateTableCommand): Promise<void> {
  try {
    await client.send(cmd)
    console.log(`Created table: ${cmd.input.TableName}`)
  } catch (err) {
    if (err instanceof ResourceInUseException) {
      console.log(`Table already exists: ${cmd.input.TableName}`)
    } else {
      throw err
    }
  }
}

await createTable(new CreateTableCommand({
  TableName: COMPANIES_TABLE,
  KeySchema: [
    { AttributeName: 'batch', KeyType: 'HASH' },
    { AttributeName: 'slug', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'batch', AttributeType: 'S' },
    { AttributeName: 'slug', AttributeType: 'S' },
    { AttributeName: 'category', AttributeType: 'S' },
  ],
  GlobalSecondaryIndexes: [{
    IndexName: 'category-index',
    KeySchema: [
      { AttributeName: 'category', KeyType: 'HASH' },
      { AttributeName: 'batch', KeyType: 'RANGE' },
    ],
    Projection: { ProjectionType: 'ALL' },
  }],
  BillingMode: 'PAY_PER_REQUEST',
}))

await createTable(new CreateTableCommand({
  TableName: METADATA_TABLE,
  KeySchema: [
    { AttributeName: 'pk', KeyType: 'HASH' },
    { AttributeName: 'sk', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'pk', AttributeType: 'S' },
    { AttributeName: 'sk', AttributeType: 'S' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
}))

console.log('All tables ready.')
