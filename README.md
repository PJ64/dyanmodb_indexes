## Example
This example deploys an Amazon API Gateway, AWS Lambda functions and an Amazon DynamoDB table with two indexes. The example demostrates using DynamoDB indexes to support the differant data patterns of the microservice.

The Amazon DynamoDB table is partitioned on the accountid attribute and also includes a sort key on the vendorid attribute, together they form the primary key. 

The local secondary index is partitioned on the accountid attribute, same as the base table, which is a requirement for this type of index. The orderdate attribute has been used as the sort key.

The global seondary index is partitioned on vendorid and orderdate is used as the sort key. The global secondary index partition key does not need to be the same as the base table. 

1. The first command will write items to the DynamoDB table.

2. The second script will get items using a scan operation using the base table sort key.

**Base Table**

Partition key = accountid

Sort key = vendorid

3. The third script will get items using a query operation against the local secondary index using an accountid and orderdate range.

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