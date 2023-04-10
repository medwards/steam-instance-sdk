// import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface SteamInstanceCdkProps {
  // Define construct properties here
}

export class SteamInstanceCdk extends Construct {

  constructor(scope: Construct, id: string, props: SteamInstanceCdkProps = {}) {
    super(scope, id);

    // Define construct contents here

    // example resource
    // const queue = new sqs.Queue(this, 'SteamInstanceCdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
