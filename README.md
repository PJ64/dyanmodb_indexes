## Example
This example deploys an Amazon API Gateway, multiple AWS Lambda functions and an Amazon DynamoDB table with two indexes. The example demonstrates using DynamoDB indexes to support the differant query patterns of a microservice. 

The Amazon DynamoDB table is partitioned on the accountid attribute and it also includes a sort key on the vendorid attribute, together they form the primary key. 

The sort key on the base table allows records to be scanned using the vendorid.

The local secondary index is partitioned on the accountid attribute, the same as the base table, which is a requirement for this type of index. The orderdate attribute has been used as the sort key. This allows us to find orders using accountid and a datetime range. For example we can query for customer orders on a particular day.

The global seondary index is partitioned on vendorid and orderdate is used as the sort key. The global secondary index partition key does not need to be the same as the base table. This index allows orders to be queried using vendorid and a datetime range. For example we can find the most recent vendor orders.

**Jupyter Notebook Scripts**

1. The first script generates new orders and them the API Gateway. The gateway invokes a Lambda function which writes the items to the DynamoDB table.

2. The second script is the json formatter used to render output

3. The third script will invoke a function that uses a scan operation against the sort key of the base table, this will return items with matching vendorid

4. The fourth script invokes a function that queries a global secondary index, which is partitioned by accountid and has a sort key on orderdate. The query filters orders by accountid and a datetime range.

5. The final script invokes a Lambda function that queries a global secondary index, which is partitioned by vendorid and has a sort key on orderdate. The query filters orders by vendorid and a datetime range.

**Base Table**

Partition key = accountid

Sort key = vendorid

1. The third script will get items using a query operation against the local secondary index using an accountid and orderdate range.

**Local Secondary Index**

Partition key = accountid

Sort key = orderdate

4. The fourth script will get items using a query operation against the global secondary index using a vendorid and orderdate range.

**Global Secondary Index**

Partition key = vendorid

Sort key = orderdate

![architecture](./images/architecture_1.png "Architecture")

## Setup

1. The following prerequisities are required for this example
  
```bash
npm install -g typescript
npm install -g aws-cdk
```

Install Jupyter Notebook following instructions on this ['site'](https://jupyter.org/install).

2. Since this CDK project uses ['Assests'](https://docs.aws.amazon.com/cdk/latest/guide/assets.html), you might need to run the following command to provision resources the AWS CDK will need to perform the deployment.

```bash 
cdk bootstrap
```

2. Install the dependencies

```bash
npm install
```

3. Execute **cdk synth** to synthesize as AWS CloudFormation template

```bash
cdk synth
```

4. Execute **cdk deploy** to deploy the template and build the stack

```bash
cdk deploy
```
5. Open the Jupyter Notebook in the **jupyter_notebook directory** follow the instructions.


## Cleanup Commands
1. Execute command: **cdk destroy**