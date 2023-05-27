import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SteamInstance } from '../lib/index';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {Fn} from 'aws-cdk-lib';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/index.ts
test('EC2 Instance Created', () => {
   const app = new cdk.App();
   const stack = new cdk.Stack(app, "TestStack");
   const instanceProps = {
       steamApps: [{
           appId: "896660",
           ports: [2456, 2458]
       }],
       instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MEDIUM),
       machineImage: new ec2.AmazonLinuxImage(),
       vpc: new ec2.Vpc(stack, 'TEST_VPC')
   };
   // WHEN
   new SteamInstance(stack, 'MyValheimServer', instanceProps);
   // THEN
   const template = Template.fromStack(stack);

   template.hasResourceProperties('AWS::EC2::SecurityGroup', {
       SecurityGroupIngress: [{ToPort: 22}, {ToPort: 2456, IpProtocol: 'tcp'}, {ToPort: 2456, IpProtocol: 'udp'}, {ToPort: 2458, IpProtocol: 'tcp'}, {ToPort: 2458, IpProtocol: 'udp'}],
       SecurityGroupEgress: [{CidrIp: "0.0.0.0/0", "IpProtocol": "-1"}],
   });

   console.log(template.findResources('AWS::EC2::Instance'));

   const expectedScript = `#!/bin/bash
apt update && apt upgrade --yes
apt install lib32gcc-s1
mkdir /opt/steamcmd
cd /opt/steamcmd
curl -sqL "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" | tar zxvf -
./steamcmd.sh +quit
(crontab -l 2>/dev/null; echo "0 0 * * 0 /opt/steamcmd/steamcmd.sh +quit") | crontab -
cd /opt/steamcmd
./steamcmd.sh +force_install_dir ./apps +login anonymous +app_update 896660 validate +quit
chown -R ubuntu:ubuntu /opt/steamcmd`;

   template.hasResourceProperties('AWS::EC2::Instance', {
       "UserData": {"Fn::Base64": expectedScript }
   });
});
