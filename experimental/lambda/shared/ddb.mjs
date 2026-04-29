import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = process.env.WORKLOADS_TABLE;

if (!TABLE) {
  throw new Error("WORKLOADS_TABLE env var is required");
}

export const userPk = (sub) => `USER#${sub}`;
export const wlSk = (id) => `WL#${id}`;
export const ARCHIVE_PK = "ARCHIVE";
