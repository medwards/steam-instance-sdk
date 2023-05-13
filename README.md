# steam-instance-cdk

A CDK construct to simplify deploying dedicated servers managed with the [Steam Console Client](https://developer.valvesoftware.com/wiki/SteamCMD) (or SteamCMD). It doesn't help with the heavy lifting of running, configuring, and updating the dedicated server but gets the ports opened and the software installed.

When deployed your EC2 instance will already have the Steam CLI utility (AKA `steamcmd`) installed in `/opt/steamcmd` including a cronjob that will periodically update it. Any Steam apps you configure will also be installed (in `/opt/steamcmd/apps`) and configured ports opened.

## Usage

1. Add `steam-instance-cdk` to the `package.json` of your CDK app. (If you do not have a CDK app use `cdk init app`)
2. In your stack import `SteamInstance` and set the `SteamInstanceProps`. You can configure the instance's block devices (disks), VPC, type, image, and key. See [Example Stack](#example-stack)
3. `cdk diff` to verify your stack looks right
4. `cdk deploy` to deploy the stack. For particularly large servers (ie CS: GO) the instance may be available but the download incomplete. You can monitor progress with `cloud-init` logs in `/var/log`.
5. You still need to `ssh` into the instance to complete additional configuration and launch services.

## Future Work

* Construct still uses `yum` by default - check the machine image and provide the right commands to the userdata script
* If `ports` is empty look up expected ports from an internal table
* Easier support for folks to bring their own disk in
* Create systemd services for each `steamApp` if it provides its launch script
  * Allow scheduling for `steamApp` updates (stop service, `steamcmd` update, start service)

## Developing

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests

## Example Stack

```
export class SteamInstancesCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, keyName: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'SteamInstancesVPC');

    const instanceProps = { 
        steamApps: [{
            appId: "896660",
            ports: [2456, 2457, 2458, 27015],
        }],
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MEDIUM),
        machineImage: ec2.MachineImage.fromSsmParameter('/aws/service/canonical/ubuntu/server/focal/stable/current/amd64/hvm/ebs-gp2/ami-id', { cachedInContext: true, os: ec2.OperatingSystemType.LINUX }),
        blockDevices: [
            {
                deviceName: "/dev/sda1",
                volume: ec2.BlockDeviceVolume.ebsFromSnapshot("snap-0fa2f1be87b00b344", { deleteOnTermination: true, volumeType: ec2.EbsDeviceVolumeType.GP2, })
            },
            {
                deviceName: "/dev/sdb",
                volume: ec2.BlockDeviceVolume.ebs(10, { encrypted: false })
            }
            // userdata script:
            // if [ -z "`lsblk -f | grep xvdb | grep ext4`" ]; then mkfs.ext4 /dev/xvdb; fi
            // echo /dev/xvdb /opt/ ext4 defaults 0 2 >> /etc/fstab
            // mount /dev/xvdb /opt
            // needs libpulse0 libatomic1
        ],
        vpc: vpc,
        vpcSubnets: {
            subnets: vpc.publicSubnets
        },
        keyName
    };

    new SteamInstance(this, 'ValheimCrossplayServer', instanceProps);
  }
}
```
