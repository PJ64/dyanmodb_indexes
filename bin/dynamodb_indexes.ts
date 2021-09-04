#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { DynamodbIndexesStack } from '../lib/dynamodb_indexes-stack';

const app = new cdk.App();
new DynamodbIndexesStack(app, 'DynamodbIndexesStack');
