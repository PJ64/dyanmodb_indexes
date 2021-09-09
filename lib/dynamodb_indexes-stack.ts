import { Stack, App, RemovalPolicy } from '@aws-cdk/core';
import { LambdaIntegration, RestApi, Cors } from '@aws-cdk/aws-apigateway';
import { AttributeType, ProjectionType, Table } from '@aws-cdk/aws-dynamodb';
import { Runtime, Code, Function } from '@aws-cdk/aws-lambda';
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement } from '@aws-cdk/aws-iam';

export class DynamodbIndexesStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id);

    //Create DynamoDB table
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

    //DynamoDB local secondary indexes
    dynamoTable.addLocalSecondaryIndex({
      indexName: 'lsi-accountid_orderdate',
      sortKey: {
        name: 'orderdate',
        type: AttributeType.STRING
      },
      nonKeyAttributes: ["vendorid","details"],
      projectionType: ProjectionType.INCLUDE
    });

    //DynamoDB global secondary indexes
    dynamoTable.addGlobalSecondaryIndex({
      indexName: 'gsi-vendorid_orderdate',
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
    
    //Setup IAM security for Lambda
    const lambda_service_role = new Role(this, "IamRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      roleName: "dynamodb_indexes"
    });

    lambda_service_role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

    lambda_service_role.addToPolicy(new PolicyStatement({
      resources: [dynamoTable.tableArn,`${dynamoTable.tableArn}/index/*`],
      actions: ['dynamodb:PutItem', 'dynamodb:GetItem','dynamodb:Scan','dynamodb:Query'],
    }));

    //Create a Lambda function to generate orders
    const lambda_post_order = new Function(this, "CreateOrdersLambdaFunction", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/post_order"),
      functionName: "dynamodb_indexes_post",
      role: lambda_service_role,
      environment: {
        'TABLENAME': dynamoTable.tableName
      }
    });

    //Query orders by accountid and order date using local secondary index
    const query_accountid_orderdate = new Function(this, "query_accountid_orderdate", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/query_accountid_orderdate"),
      functionName: "dynamodb_indexes_query_accountid_orderdate",
      role: lambda_service_role,
      environment: {
        'TABLENAME': dynamoTable.tableName
      }
    });

    //Query orders by vendorid and order date using global secondary index
    const query_vendorid_orderdate = new Function(this, "query_vendorid_orderdate", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/query_vendorid_orderdate"),
      functionName: "dynamodb_indexes_query_vendorid_orderdate",
      role: lambda_service_role,
      environment: {
        'TABLENAME': dynamoTable.tableName
      }
    });

    //Scan vendorid using base table
    const scan_orders_vid = new Function(this, "ScanLambdaFunction", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/scan_vendorid"),
      functionName: "dynamodb_indexes_scan_vendorid",
      role: lambda_service_role,
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

    var lambda_post_integration = new LambdaIntegration(lambda_post_order, {
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
