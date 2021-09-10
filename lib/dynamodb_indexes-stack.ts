import { Stack, App, RemovalPolicy } from '@aws-cdk/core';
import { LambdaIntegration, RestApi, Cors } from '@aws-cdk/aws-apigateway';
import { AttributeType, ProjectionType, Table } from '@aws-cdk/aws-dynamodb';
import { Runtime, Code, Function } from '@aws-cdk/aws-lambda';
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement } from '@aws-cdk/aws-iam';

export class DynamodbIndexesStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id);

    //Create DynamoDB table to hold the orders
    const dynamoTable = new Table(this, "DynamoDBTable", {
      partitionKey: {
        name: 'accountid',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'vendorid',
        type: AttributeType.STRING
      },
      tableName: 'dynamodb_indexes',
      removalPolicy: RemovalPolicy.DESTROY
    });

    //DynamoDB local secondary index with accountid as the partition key and orderdate as the sortkey
    dynamoTable.addLocalSecondaryIndex({
      indexName: 'lsi_accountid_orderdate',
      sortKey: {
        name: 'orderdate',
        type: AttributeType.STRING
      },
      nonKeyAttributes: ["vendorid","details"],
      projectionType: ProjectionType.INCLUDE
    });

    //DynamoDB global secondary index with vendorid as the partition key and orderdate as the sortkey
    dynamoTable.addGlobalSecondaryIndex({
      indexName: 'gsi_vendorid_orderdate',
      partitionKey: {
        name: 'vendorid',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'orderdate',
        type: AttributeType.STRING
      },
      nonKeyAttributes: ["vendorid","accountid", "details"],
      projectionType: ProjectionType.INCLUDE
    });
    
    //Setup IAM security for Lambda functions
    //Lambda role used to put_item to dynamodb
    const lambda_service_role_put = new Role(this, "lambda_service_role_put", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      roleName: "dynamodb_indexes_put"
    });
    lambda_service_role_put.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

    lambda_service_role_put.addToPolicy(new PolicyStatement({
      resources: [dynamoTable.tableArn,`${dynamoTable.tableArn}/index/*`],
      actions: ['dynamodb:PutItem'],
    }));

    //Lambda role used to get_item to dynamodb
    const lambda_service_role_scan = new Role(this, "lambda_service_role_scan", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      roleName: "dynamodb_indexes_scan"
    });
    lambda_service_role_scan.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

    lambda_service_role_scan.addToPolicy(new PolicyStatement({
      resources: [dynamoTable.tableArn,`${dynamoTable.tableArn}/index/*`],
      actions: ['dynamodb:Scan'],
    }));

    //Lambda role to query global secondary index
    const lambda_service_role_gsi_query = new Role(this, "lambda_service_role_gsi_query", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      roleName: "dynamodb_indexes_gsi_query"
    });
    lambda_service_role_gsi_query.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

    lambda_service_role_gsi_query.addToPolicy(new PolicyStatement({
      resources: [dynamoTable.tableArn,`${dynamoTable.tableArn}/index/*`],
      actions: ['dynamodb:GetItem','dynamodb:Scan','dynamodb:Query'],
    }));

    //Lambda role to query local secondary index
    const lambda_service_role_lsi_query = new Role(this, "lambda_service_role_lsi_query", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      roleName: "dynamodb_indexes_lsi_query"
    });
    lambda_service_role_lsi_query.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

    lambda_service_role_lsi_query.addToPolicy(new PolicyStatement({
      resources: [dynamoTable.tableArn,`${dynamoTable.tableArn}/index/*`],
      actions: ['dynamodb:GetItem','dynamodb:Scan','dynamodb:Query'],
    }));

    //Create a Lambda function used to put items into dynamodb
    const lambda_put_order = new Function(this, "lambda_put_order", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/function_put_order"),
      functionName: "dynamodb_indexes_put",
      role: lambda_service_role_put,
      environment: {
        'TABLENAME': dynamoTable.tableName
      }
    });

    //Query orders by accountid and orderdate using local secondary index
    const query_accountid_orderdate = new Function(this, "query_accountid_orderdate", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/function_query_accountid_orderdate"),
      functionName: "dynamodb_indexes_query_accountid_orderdate",
      role: lambda_service_role_lsi_query,
      environment: {
        'TABLENAME': dynamoTable.tableName
      }
    });

    //Query orders by vendorid and orderdate using global secondary index
    const query_vendorid_orderdate = new Function(this, "query_vendorid_orderdate", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/function_query_vendorid_orderdate"),
      functionName: "dynamodb_indexes_query_vendorid_orderdate",
      role: lambda_service_role_gsi_query,
      environment: {
        'TABLENAME': dynamoTable.tableName
      }
    });

    //Scan vendorid using base table
    const scan_orders_vid = new Function(this, "ScanLambdaFunction", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/function_scan_vendorid"),
      functionName: "dynamodb_indexes_scan_vendorid",
      role: lambda_service_role_scan,
      environment: {
        'TABLENAME': dynamoTable.tableName
      }
    });

    //Create REST Api and integrate the Lambda functions
    var api = new RestApi(this, "OrderApi", {
      restApiName: "dynamodb_indexes",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS
      }
    });

    var lambda_post_integration = new LambdaIntegration(lambda_put_order, {
      requestTemplates: {
        ["application/json"]: "{ \"statusCode\": \"200\" }"
      }
    });

    var integration_query_vendorid_orderdate = new LambdaIntegration(query_vendorid_orderdate);
    var integration_query_accountid_orderdate = new LambdaIntegration(query_accountid_orderdate);
    var order_vid = new LambdaIntegration(scan_orders_vid);

    var apiresource = api.root.addResource("order");
    var query = api.root.addResource("query");
    var query_vendor = query.addResource("vendor")
    var query_account = query.addResource("account")
    var scan = api.root.addResource("scan");

    apiresource.addMethod("POST", lambda_post_integration);
    query_vendor.addMethod("GET", integration_query_vendorid_orderdate);
    query_account.addMethod("GET", integration_query_accountid_orderdate);
    scan.addMethod("GET", order_vid);
  }
}
