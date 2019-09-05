## Amazon Transcribe News Media Analysis

Transcribe news audio in realtime.

> Warning: This project is currently being developed and the code shouldn't be used in production.

[![Build Status](https://travis-ci.org/aws-samples/amazon-transcribe-news-media-analysis.svg?branch=master)](https://travis-ci.org/aws-samples/amazon-transcribe-news-media-analysis)

### Deployment

The application is deployed as an [AWS CloudFormation](https://aws.amazon.com/cloudformation) template.

> **Note**  
You are responsible for the cost of the AWS services used while running this sample deployment. There is no additional cost for using this sample. For full details, see the pricing pages for each AWS service you will be using in this sample. Prices are subject to change.

> **Note**   
This template will deploy a Front-end layer that will contain some public S3 objects. The deployment will fail if the Public Objects are blocked on an account level.

1. Deploy the latest CloudFormation template by following the link below for your preferred AWS region:

|Region|Launch Template|
|------|---------------|
|**US East (N. Virginia)** (us-east-1) | [![Launch the EngagementMeter Stack with CloudFormation](docs/deploy-to-aws.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?stackName=MediaAnalysis&templateURL=https://solution-builders-us-east-1.s3.us-east-1.amazonaws.com/amazon-transcribe-news-media-analysis/latest/main.template)|
|**US East (Ohio)** (us-east-2) | [![Launch the EngagementMeter Stack with CloudFormation](docs/deploy-to-aws.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/new?stackName=MediaAnalysis&templateURL=https://solution-builders-us-east-2.s3.uus-east-2.amazonaws.com/amazon-transcribe-news-media-analysis/latest/main.template)|
|**US West (Oregon)** (us-west-2) | [![Launch the EngagementMeter Stack with CloudFormation](docs/deploy-to-aws.png)](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/new?stackName=MediaAnalysis&templateURL=https://solution-builders-us-west-2.s3.us-west-2.amazonaws.com/amazon-transcribe-news-media-analysis/latest/main.template)|
|**Asia Pacific (Sydney)** (ap-southeast-2) | [![Launch the EngagementMeter Stack with CloudFormation](docs/deploy-to-aws.png)](https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-2#/stacks/new?stackName=MediaAnalysis&templateURL=https://solution-builders-ap-southeast-2.s3.ap-southeast-2.amazonaws.com/amazon-transcribe-news-media-analysis/latest/main.template)|
|**Canada (Central)** (ca-central-1) | [![Launch the EngagementMeter Stack with CloudFormation](docs/deploy-to-aws.png)](https://console.aws.amazon.com/cloudformation/home?region=ca-central-1#/stacks/new?stackName=MediaAnalysis&templateURL=https://solution-builders-ca-central-1.s3.ca-central-1.amazonaws.com/amazon-transcribe-news-media-analysis/latest/main.template)|
|**EU (Ireland)** (eu-west-1) | [![Launch the EngagementMeter Stack with CloudFormation](docs/deploy-to-aws.png)](https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/new?stackName=MediaAnalysis&templateURL=https://solution-builders-eu-west-1.s3.eu-west-1.amazonaws.com/amazon-transcribe-news-media-analysis/latest/main.template)|

2. If prompted, login using your AWS account credentials.
1. You should see a screen titled "*Create Stack*" at the "*Specify template*" step. The fields specifying the CloudFormation template are pre-populated. Click the *Next* button at the bottom of the page.
1. On the "*Specify stack details*" screen you may customize the following parameters of the CloudFormation stack:
  * **Stack Name:** (Default: MediaAnalysis) This is the name that is used to refer to this stack in CloudFormation once deployed. The value must be 15 characters or less.
  * **MaxTaskCapacity:** (Default: 10) The application allows to process multiple media streams. For each processing task, a Fargate Task is created. You must customise this if you are planning to process more than 10 media streams.
  * **PrivateSubnetIpBlocks** (Default: 10.0.0.0/22, 10.0.4.0/22, 10.0.8.0/22) The Fargate Tasks will be placed in the Private subnets using the Given Ip Blocks. You must customise this if you are running other VPCs in the same AWS account.
  * **PublicSubnetIpBlocks** (Default: 10.0.12.0/22, 10.0.16.0/22, 10.0.20.0/22) The Fargate Tasks will use the Public subnets for accessing the Transcribe Service using the Given Ip Blocks. You must customise this if you are running other VPCs in the same AWS account.
  * **RetryThreshold** (Default: 3) The number of times to retry transcription if an error is encountered.
  * **TaskName** (Default: transcriber) The Fargate taskname. You must customise this if you are already running a task with the same name.
  * **VpcIpBlock** (Default: 10.0.0.0/16) The CIDR block for the VPC. You must customise this if you are running other VPCs in the same AWS account.

   When completed, click *Next*
1. [Configure stack options](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-add-tags.html) if desired, then click *Next*.
1. On the review you screen, you must check the boxes for:
   * "*I acknowledge that AWS CloudFormation might create IAM resources*" 
   * "*I acknowledge that AWS CloudFormation might create IAM resources with custom names*"
   * "*I acknowledge that AWS CloudFormation might require the following capability: CAPABILITY_AUTO_EXPAND*"

   These are required to allow CloudFormation to create a Role to allow access to resources needed by the stack and name the resources in a dynamic way.
1. Click *Create Change Set* 
1. On the *Change Set* screen, click *Execute* to launch your stack.
   * You may need to wait for the *Execution status* of the change set to become "*AVAILABLE*" before the "*Execute*" button becomes available.
1. Wait for the CloudFormation stack to launch. Completion is indicated when the "Stack status" is "*CREATE_COMPLETE*".
   * You can monitor the stack creation progress in the "Events" tab.
1. Note the *url* displayed in the *Outputs* tab for the stack. This is used to access the application.

#### Accessing the Application

The application is accessed using a web browser. The address is the *url* output from the CloudFormation stack created during the Deployment steps.

* Click "*Add new...  *" if you wish to add new media stream.
* Click on the "*Open in a new window*" icon to start streaming the media with the transcription.

### Remove the application

To remove the application open the AWS CloudFormation Console, click the MediaAnalysis project, right-click and select "*Delete Stack*". Your stack will take some time to be deleted. You can track its progress in the "Events" tab. When it is done, the status will change from DELETE_IN_PROGRESS" to "DELETE_COMPLETE". It will then disappear from the list.

### Transcriber

To run the Transciber as a standalone application run the following shell commands:

```bash
cd /src/backend/transcriber

docker build -t transcriber .

docker run
--env AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
--env AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
--env TRANSCRIPTS_DYNAMO_DB_TABLE=MediaAnalysisTranscript
--env LOG_LEVEL=INFO
--env AWS_REGION=${AWS_REGION}
--env TASKS_DYNAMO_DB_TABLE=MediaAnalysisTasks
--env MEDIA_URL=${MEDIA_URL}
transcriber java -jar -Dlog4j.configurationFile=log4j2.xml /transcriber.jar
```

## License

This library is licensed under the MIT-0 License. 
