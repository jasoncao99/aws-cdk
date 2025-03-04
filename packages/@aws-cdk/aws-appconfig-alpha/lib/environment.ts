import { Resource, IResource, Stack, ArnFormat, PhysicalName, Names } from 'aws-cdk-lib';
import { CfnEnvironment } from 'aws-cdk-lib/aws-appconfig';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { IApplication } from './application';
import { ActionPoint, IEventDestination, ExtensionOptions, IExtension, IExtensible, ExtensibleBase } from './extension';

/**
 * Attributes of an existing AWS AppConfig environment to import it.
 */
export interface EnvironmentAttributes {
  /**
   * The application associated with the environment.
   */
  readonly application: IApplication;

  /**
   * The ID of the environment.
   */
  readonly environmentId: string;

  /**
   * The name of the environment.
   */
  readonly name?: string;

  /**
   * The description of the environment.
   */
  readonly description?: string;

  /**
   * The monitors for the environment.
   */
  readonly monitors?: Monitor[];
}

abstract class EnvironmentBase extends Resource implements IEnvironment, IExtensible {
  public abstract applicationId: string;
  public abstract environmentId: string;
  public abstract environmentArn: string;
  protected extensible!: ExtensibleBase;

  public on(actionPoint: ActionPoint, eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.on(actionPoint, eventDestination, options);
  }

  public preCreateHostedConfigurationVersion(eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.preCreateHostedConfigurationVersion(eventDestination, options);
  }

  public preStartDeployment(eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.preStartDeployment(eventDestination, options);
  }

  public onDeploymentStart(eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.onDeploymentStart(eventDestination, options);
  }

  public onDeploymentStep(eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.onDeploymentStep(eventDestination, options);
  }

  public onDeploymentBaking(eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.onDeploymentBaking(eventDestination, options);
  }

  public onDeploymentComplete(eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.onDeploymentComplete(eventDestination, options);
  }

  public onDeploymentRolledBack(eventDestination: IEventDestination, options?: ExtensionOptions) {
    this.extensible.onDeploymentRolledBack(eventDestination, options);
  }

  public addExtension(extension: IExtension) {
    this.extensible.addExtension(extension);
  }
}

export interface EnvironmentOptions {
  /**
   * The name of the environment.
   *
   * @default - A name is generated.
   */
  readonly name?: string;

  /**
   * The description of the environment.
   *
   * @default - No description.
   */
  readonly description?: string;

  /**
   * The monitors for the environment.
   *
   * @default - No monitors.
   */
  readonly monitors?: Monitor[];
}

export interface EnvironmentProps extends EnvironmentOptions {
  /**
   * The application to be associated with the environment.
   */
  readonly application: IApplication;
}

/**
 * An AWS AppConfig environment.
 *
 * @resource AWS::AppConfig::Environment
 * @see https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-creating-environment.html
 */
export class Environment extends EnvironmentBase {
  /**
   * Imports an environment into the CDK using its Amazon Resource Name (ARN).
   *
   * @param scope The parent construct
   * @param id The name of the environment construct
   * @param environmentArn The Amazon Resource Name (ARN) of the environment
   */
  public static fromEnvironmentArn(scope: Construct, id: string, environmentArn: string): IEnvironment {
    const parsedArn = Stack.of(scope).splitArn(environmentArn, ArnFormat.SLASH_RESOURCE_NAME);
    if (!parsedArn.resourceName) {
      throw new Error(`Missing required /$/{applicationId}/environment//$/{environmentId} from environment ARN: ${parsedArn.resourceName}`);
    }

    const resourceName = parsedArn.resourceName.split('/');
    if (resourceName.length != 3 || !resourceName[0] || !resourceName[2]) {
      throw new Error('Missing required parameters for environment ARN: format should be /$/{applicationId}/environment//$/{environmentId}');
    }

    const applicationId = resourceName[0];
    const environmentId = resourceName[2];

    class Import extends EnvironmentBase {
      public readonly applicationId = applicationId;
      public readonly environmentId = environmentId;
      public readonly environmentArn = environmentArn;
    }

    return new Import(scope, id, {
      environmentFromArn: environmentArn,
    });
  }

  /**
   * Imports an environment into the CDK from its attributes.
   *
   * @param scope The parent construct
   * @param id The name of the environment construct
   * @param attr The attributes of the environment
   */
  public static fromEnvironmentAttributes(scope: Construct, id: string, attr: EnvironmentAttributes): IEnvironment {
    const applicationId = attr.application.applicationId;
    const environmentId = attr.environmentId;

    const stack = Stack.of(scope);
    const environmentArn = stack.formatArn({
      service: 'appconfig',
      resource: 'application',
      resourceName: `${applicationId}/environment/${environmentId}`,
    });

    class Import extends EnvironmentBase {
      public readonly application = attr.application;
      public readonly applicationId = attr.application.applicationId;
      public readonly name = attr.name;
      public readonly environmentId = environmentId;
      public readonly environmentArn = environmentArn;
      public readonly description = attr.description;
      public readonly monitors = attr.monitors;
    }

    return new Import(scope, id, {
      environmentFromArn: environmentArn,
    });
  }

  /**
   * The application associated with the environment.
   */
  public readonly application?: IApplication;

  /**
   * The name of the environment.
   */
  public readonly name?: string;

  /**
   * The description of the environment.
   */
  public readonly description?: string;

  /**
   * The monitors for the environment.
   */
  public readonly monitors?: Monitor[];

  /**
   * The ID of the environment.
   */
  public readonly environmentId: string;

  /**
   * The Amazon Resource Name (ARN) of the environment.
   */
  public readonly environmentArn: string;

  /**
   * The ID of the environment.
   */
  public readonly applicationId: string;

  private readonly _cfnEnvironment: CfnEnvironment;

  constructor(scope: Construct, id: string, props: EnvironmentProps) {
    super(scope, id, {
      physicalName: props.name,
    });

    this.name = props.name || Names.uniqueResourceName(this, {
      maxLength: 64,
      separator: '-',
    });
    this.application = props.application;
    this.applicationId = this.application.applicationId;
    this.description = props.description;
    this.monitors = props.monitors;

    const resource = new CfnEnvironment(this, 'Resource', {
      applicationId: this.applicationId,
      name: this.name,
      description: this.description,
      monitors: this.monitors?.map((monitor, index) => {
        return {
          alarmArn: monitor.alarm.alarmArn,
          alarmRoleArn: monitor.alarmRole?.roleArn || this.createAlarmRole(monitor.alarm.alarmArn, index).roleArn,
        };
      }),
    });
    this._cfnEnvironment = resource;

    this.environmentId = this._cfnEnvironment.ref;
    this.environmentArn = this.stack.formatArn({
      service: 'appconfig',
      resource: 'application',
      resourceName: `${this.applicationId}/environment/${this.environmentId}`,
    });
    this.extensible = new ExtensibleBase(scope, this.environmentArn, this.name);

    this.application.addExistingEnvironment(this);
  }

  private createAlarmRole(alarmArn: string, index: number): iam.IRole {
    const policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:DescribeAlarms'],
      resources: [alarmArn],
    });
    const document = new iam.PolicyDocument({
      statements: [policy],
    });
    const role = new iam.Role(this, `Role${index}`, {
      roleName: PhysicalName.GENERATE_IF_NEEDED,
      assumedBy: new iam.ServicePrincipal('appconfig.amazonaws.com'),
      inlinePolicies: {
        ['AllowAppConfigMonitorAlarmPolicy']: document,
      },
    });
    return role;
  }
}

/**
 * Defines monitors that will be associated with an AWS AppConfig environment.
 */
export interface Monitor {
  /**
   * The Amazon CloudWatch alarm.
   */
  readonly alarm: cloudwatch.IAlarm;

  /**
   * The IAM role for AWS AppConfig to view the alarm state.
   *
   * @default - A role is generated.
   */
  readonly alarmRole?: iam.IRole;
}

export interface IEnvironment extends IResource {
  /**
   * The application associated with the environment.
   */
  readonly application?: IApplication;

  /**
   * The ID of the application associated to the environment.
   */
  readonly applicationId: string;

  /**
   * The name of the environment.
   */
  readonly name?: string;

  /**
   * The description of the environment.
   */
  readonly description?: string;

  /**
   * The monitors for the environment.
   */
  readonly monitors?: Monitor[];

  /**
   * The ID of the environment.
   */
  readonly environmentId: string;

  /**
   * The Amazon Resource Name (ARN) of the environment.
   */
  readonly environmentArn: string;

  /**
   * Adds an extension defined by the action point and event destination and also
   * creates an extension association to the environment.
   *
   * @param actionPoint The action point which triggers the event
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  on(actionPoint: ActionPoint, eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds a PRE_CREATE_HOSTED_CONFIGURATION_VERSION extension with the provided event destination
   * and also creates an extension association to the environment.
   *
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  preCreateHostedConfigurationVersion(eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds a PRE_START_DEPLOYMENT extension with the provided event destination and also creates
   * an extension association to the environment.
   *
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  preStartDeployment(eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds an ON_DEPLOYMENT_START extension with the provided event destination and also creates
   * an extension association to the environment.
   *
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  onDeploymentStart(eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds an ON_DEPLOYMENT_STEP extension with the provided event destination and also
   * creates an extension association to the environment.
   *
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  onDeploymentStep(eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds an ON_DEPLOYMENT_BAKING extension with the provided event destination and
   * also creates an extension association to the environment.
   *
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  onDeploymentBaking(eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds an ON_DEPLOYMENT_COMPLETE extension with the provided event destination and
   * also creates an extension association to the environment.
   *
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  onDeploymentComplete(eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds an ON_DEPLOYMENT_ROLLED_BACK extension with the provided event destination and
   * also creates an extension association to the environment.
   *
   * @param eventDestination The event that occurs during the extension
   * @param options Options for the extension
   */
  onDeploymentRolledBack(eventDestination: IEventDestination, options?: ExtensionOptions): void;

  /**
   * Adds an extension association to the environment.
   *
   * @param extension The extension to create an association for
   */
  addExtension(extension: IExtension): void;
}