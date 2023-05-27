import {Construct} from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface SteamAppProps {
    appId: string;
    ports: number[];
    betaName?: string;
    betaPassword?: string;
}

// Only vpc, vpcSubnets, instanceType, machineImage, and keyName are honoured
// TODO: pass all the fields to instance launch - handle manipulated fields (security groups, userdata)
export interface SteamInstanceProps extends ec2.InstanceProps {
    steamApps: SteamAppProps[];
}

export class SteamInstance extends Construct {
    instance: ec2.Instance;

    static steamSetupUserData(steamApps: SteamAppProps[]): ec2.UserData {
        var script = ec2.UserData.forLinux();
        script.addCommands(
            'apt update && apt upgrade --yes',
            // yum -y install libstdc++ libstdc++64.i686 glibc.i686 on redhat/AL2
            'apt install lib32gcc-s1',
            'mkdir /opt/steamcmd',
            'cd /opt/steamcmd',
            'curl -sqL "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" | tar zxvf -',
            './steamcmd.sh +quit',
            '(crontab -l 2>/dev/null; echo "0 0 * * 0 /opt/steamcmd/steamcmd.sh +quit") | crontab -'
        );
        // Allow access to the specified ports for all Steam apps
        for (const app of steamApps) {
            script.addCommands('cd /opt/steamcmd',
                // install (TODO: use beta info)
                `./steamcmd.sh +force_install_dir ./apps +login anonymous +app_update ${app.appId} validate +quit`
            );
        }
        // Fix ownership - ec2-user on redhat/AL2
        script.addCommands(
            'chown -R ubuntu:ubuntu /opt/steamcmd',
        )

        return script;
    }

    constructor(scope: Construct, id: string, props: SteamInstanceProps) {
        super(scope, id);

        // Launch script
        var launchScript = props.userData ?? SteamInstance.steamSetupUserData(props.steamApps);
        // Create the VPC and security group for the instance
        const sg = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {vpc: props.vpc});

        // Allow SSH access to the instance from anywhere
        sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

        // Allow access to the specified ports for all Steam apps
        for (const app of props.steamApps) {
            for (const port of app.ports) {
                sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(port));
                sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(port));
            }
        }

        // Launch the EC2 instance
        this.instance = new ec2.Instance(this, 'MyInstance', {
            blockDevices: props.blockDevices,
            vpc: props.vpc,
            vpcSubnets: props.vpcSubnets,
            securityGroup: sg,
            instanceType: props.instanceType || ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            machineImage: props.machineImage || new ec2.AmazonLinuxImage(),
            keyName: props.keyName,
            userData: launchScript
        });
    }
}
