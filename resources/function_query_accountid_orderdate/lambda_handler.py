import json
import boto3
import logging
import os
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

logger = logging.getLogger()

def lambda_handler(event, context):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ.get('TABLENAME'))

    queryParam = event["queryStringParameters"]
    
    try:
        pe = "vendorid, details"
        response = table.query(IndexName='lsi_accountid_orderdate',KeyConditionExpression=Key('accountid').eq(queryParam["accountid"]) & Key('orderdate').between(queryParam["from"],queryParam["to"]),ProjectionExpression=pe)

        return {
            'statusCode': 200,
            'headers': {
                "Content-Type": 'application/json',
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": 'Content-Type,X-Amz-Date,X-Api-Key',
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            'body': json.dumps(response)
        }
    except ClientError:
        logger.exception("Couldn't Getitem from table %s",table)
        raise