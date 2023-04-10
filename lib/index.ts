import {Construct} from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface SteamAppProps {
    appId: string;
    ports: number[];
    betaName?: string;
    betaPassword?: string;
}

export interface SteamInstanceProps extends ec2.InstanceProps {
    steamApps: SteamAppProps[];
}

export class SteamInstance extends Construct {
    constructor(scope: Construct, id: string, props: SteamInstanceProps) {
        super(scope, id);

        // Launch script
        var launchScript = ec2.UserData.forLinux({shebang: "#!/bin/bash"});
        launchScript.addCommands(
            'yum -y update',
            'yum -y install lib32gcc1 libstdc++ libstdc++.i686',
            'mkdir /opt/steamcmd',
            'cd /opt/steamcmd',
            // Download and install
            'curl -sqL "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" | tar zxvf -',
            // Runs updater
            './steamcmd.sh +quit',
            // Schedule updates
            '(crontab -l 2>/dev/null; echo "0 0 * * 0 /opt/steamcmd/steamcmd.sh +quit") | crontab -'
        );

        // Create the VPC and security group for the instance
        const sg = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {vpc: props.vpc});

        // Allow SSH access to the instance from anywhere
        sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

        // Allow access to the specified ports for all Steam apps
        for (const app of props.steamApps) {
            for (const port of app.ports) {
                sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(port));
                // TODO: Move this out of UserData to something that isn't critical to instance startup
            }
            launchScript.addCommands('cd /opt/steamcmd',
                // login
                './steamcmd.sh +login anonymous',
                // set install dir
                // TODO
                // install (TODO: use beta info)
                `./steamcmd.sh +app_update ${app.appId} validate`
            );
        }

        // Launch the EC2 instance
        const instance = new ec2.Instance(this, 'MyInstance', {
            vpc: props.vpc,
            securityGroup: sg,
            instanceType: props.instanceType || ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            machineImage: props.machineImage || new ec2.AmazonLinuxImage(),
            keyName: props.keyName,
            userData: launchScript
        });
    }
}
