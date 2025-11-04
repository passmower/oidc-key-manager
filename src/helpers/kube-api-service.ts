import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  makeInformer,
  PatchUtils, V1Deployment,
  V1Secret,
} from '@kubernetes/client-node'
import {CommonFlagsInterface, ConfigType} from './common-flags'
import {Command} from '@oclif/core'
import {Secret} from './secret'

const Undefined = 'undefined'

export class KubeApiService {
  private kc: KubeConfig
  private coreV1Api: CoreV1Api
  private appsV1Api: AppsV1Api
  private namespace: string
  private command: Command
  private secretName: any

  constructor(command: Command, flags: CommonFlagsInterface) {
    this.command = command
    this.kc = new KubeConfig()
    flags.config === ConfigType.InCluster ? this.kc.loadFromCluster() : this.kc.loadFromDefault()
    this.namespace = flags.namespace ?? this.kc.getContextObject(this.kc.getCurrentContext())?.namespace ?? Undefined
    this.coreV1Api = this.kc.makeApiClient(CoreV1Api)
    this.appsV1Api = this.kc.makeApiClient(AppsV1Api)
    this.secretName = flags.secret
    this.#validate()
  }

  #validate(): void {
    if (this.namespace === Undefined) {
      this.command.error(
        'namespace is undefined',
        {
          suggestions: [
            'set namespace with -n',
            'configure service account for this deployment/job',
          ],
        })
    }
  }

  printConfiguration(): void {
    this.command.log('Using Kubernetes parameters:', {
      ...this.kc.getContextObject(this.kc.getCurrentContext()),
      server: this.kc.getCurrentCluster()?.server,
      secretName: this.secretName,
    })
  }

  async restartDeployment(deploymentName: string, timeoutInSeconds: number): Promise<any> {
    this.command.log(`Restarting deployment ${deploymentName}`)
    await this.appsV1Api.patchNamespacedDeployment(
      deploymentName,
      this.namespace,
      {
        spec: {
          template: {
            metadata: {
              annotations: {
                'kubectl.kubernetes.io/restartedAt': String(Date.now()),
              },
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {headers: {'Content-type': PatchUtils.PATCH_FORMAT_JSON_MERGE_PATCH}},
    )

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        informer.stop()
        reject(new Error(`Failed to observe new ReplicaSet before ${timeoutInSeconds} seconds`))
      }, timeoutInSeconds * 1000)

      // eslint-disable-next-line unicorn/consistent-function-scoping
      const listFn = () => this.appsV1Api.listNamespacedDeployment(this.namespace)
      const informer = makeInformer(this.kc, `/apis/apps/v1/namespaces/${this.namespace}/deployments/`, listFn)
      informer.on('update', (obj: V1Deployment) => {
        const conditions = obj?.status?.conditions
        if (conditions && obj?.metadata?.name === deploymentName) {
          const progressingCondition = conditions.find((c: any) => c.type === 'Progressing')
          if (progressingCondition?.reason === 'NewReplicaSetAvailable') {
            this.command.log('Deployment finished restarting')
            clearTimeout(timeout)
            informer.stop()
            resolve(obj)
          }
        }
      })
      informer.start()
      this.command.log('Waiting for deployment to restart')
    })
  }

  async getSecret(): Promise<V1Secret|undefined|null> {
    this.command.log(`Checking if secret ${this.secretName} exists`)
    const secret = await this.coreV1Api.readNamespacedSecret(this.secretName, this.namespace)
    .then(response => response.body)
    .catch(error => {
      if (error.statusCode !== 404) {
        this.command.error(error)
      }

      return null
    })
    this.command.log(secret ? `Secret ${this.secretName} exists` : `Secret ${this.secretName} does not exist`)
    return secret
  }

  async deleteSecret(): Promise<void> {
    this.command.log(`Deleting existing secret ${this.secretName}`)
    await this.coreV1Api.deleteNamespacedSecret(this.secretName, this.namespace).then(() => true)
    this.command.log(`Existing secret ${this.secretName} deleted`)
  }

  async createSecret(secret: Secret, labels?: string[]): Promise<void> {
    this.command.log(`Creating secret ${this.secretName}`)
    try {
      await this.coreV1Api.createNamespacedSecret(this.namespace, secret.toKubeSecret(this.secretName, labels))
    } catch (error) {
      console.error(error)
    }
    this.command.log(`Created secret ${this.secretName}`)
  }

  async replaceSecret(secret: Secret, labels?: string[]): Promise<void> {
    this.command.log(`Replacing secret ${this.secretName}`)
    await this.coreV1Api.replaceNamespacedSecret(
      this.secretName,
      this.namespace,
      secret.toKubeSecret(this.secretName, labels),
    )
  }
}
