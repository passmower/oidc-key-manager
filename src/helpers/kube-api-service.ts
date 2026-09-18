import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  makeInformer,
  RequestContext,
  ResponseContext,
  V1Deployment,
  V1Secret,
} from '@kubernetes/client-node'
import * as rx from '@kubernetes/client-node/dist/gen/rxjsStub.js'
import {Command} from '@oclif/core'

import {CommonFlagsInterface, ConfigType} from './common-flags'
import {apiServerUrlViaServiceDns} from './kube-api-server-url'
import {Secret} from './secret'

const Undefined = 'undefined'

// The Kubernetes client surfaces the HTTP status on different properties
// depending on which layer raised the error, so probe all of them.
type KubeApiError = Error & {
  code?: number
  response?: {statusCode?: number}
  statusCode?: number
}

export class KubeApiService {
  private appsV1Api: AppsV1Api
  private command: Command
  private coreV1Api: CoreV1Api
  private kc: KubeConfig
  private namespace: string
  private secretName: string

  constructor(command: Command, flags: CommonFlagsInterface) {
    this.command = command
    this.kc = new KubeConfig()
    if (flags.config === ConfigType.InCluster) {
      this.kc.loadFromCluster()
      // Must run before makeApiClient(), which captures cluster.server eagerly.
      const dnsServer = apiServerUrlViaServiceDns()
      if (dnsServer) {
        const cluster = this.kc.getCurrentCluster()
        if (cluster) {
          this.command.log(`Kubernetes: using service DNS for the API server to avoid IPv6 TLS SAN mismatch (${cluster.server} -> ${dnsServer})`)
          // Cluster.server is readonly, so rebuild the entry rather than mutate it.
          this.kc.clusters = this.kc.clusters.map(c => (c.name === cluster.name ? {...c, server: dnsServer} : c))
        }
      }
    } else {
      this.kc.loadFromDefault()
    }

    this.namespace = flags.namespace ?? this.kc.getContextObject(this.kc.getCurrentContext())?.namespace ?? Undefined
    this.coreV1Api = this.kc.makeApiClient(CoreV1Api)
    this.appsV1Api = this.kc.makeApiClient(AppsV1Api)
    this.secretName = flags.secret
    this.#validate()
  }

  async createSecret(secret: Secret, labels?: string[]): Promise<void> {
    this.command.log(`Creating secret ${this.secretName}`)
    try {
      await this.coreV1Api.createNamespacedSecret({
        body: secret.toKubeSecret(this.secretName, labels),
        namespace: this.namespace,
      })
    } catch (error) {
      console.error(error)
    }

    this.command.log(`Created secret ${this.secretName}`)
  }

  async deleteSecret(): Promise<void> {
    this.command.log(`Deleting existing secret ${this.secretName}`)
    await this.coreV1Api.deleteNamespacedSecret({
      name: this.secretName,
      namespace: this.namespace,
    }).then(() => true)
    this.command.log(`Existing secret ${this.secretName} deleted`)
  }

  async getSecret(): Promise<null | undefined | V1Secret> {
    this.command.log(`Checking if secret ${this.secretName} exists`)
    const secret = await this.coreV1Api.readNamespacedSecret({
      name: this.secretName,
      namespace: this.namespace,
    })
    .catch((error: KubeApiError) => {
      if (error.statusCode !== 404 && error.code !== 404 && error.response?.statusCode !== 404) {
        this.command.error(error)
      }

      return null
    })
    this.command.log(secret ? `Secret ${this.secretName} exists` : `Secret ${this.secretName} does not exist`)
    return secret
  }

  printConfiguration(): void {
    this.command.log('Using Kubernetes parameters:', {
      ...this.kc.getContextObject(this.kc.getCurrentContext()),
      secretName: this.secretName,
      server: this.kc.getCurrentCluster()?.server,
    })
  }

  async replaceSecret(secret: Secret, labels?: string[]): Promise<void> {
    this.command.log(`Replacing secret ${this.secretName}`)
    await this.coreV1Api.replaceNamespacedSecret({
      body: secret.toKubeSecret(this.secretName, labels),
      name: this.secretName,
      namespace: this.namespace,
    })
  }

  async restartDeployment(deploymentName: string, timeoutInSeconds: number): Promise<V1Deployment> {
    this.command.log(`Restarting deployment ${deploymentName}`)
    await this.appsV1Api.patchNamespacedDeployment({
      body: {
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
      name: deploymentName,
      namespace: this.namespace,
    }, {
      middleware: [{
        post(context: ResponseContext) {
          return rx.of(context)
        },
        pre(context: RequestContext) {
          context.setHeaderParam('Content-Type', 'application/strategic-merge-patch+json')
          return rx.of(context)
        },
      }],
    })
    return new Promise<V1Deployment>((resolve, reject) => {
      const timeout = setTimeout(() => {
        informer.stop()
        reject(new Error(`Failed to observe new ReplicaSet before ${timeoutInSeconds} seconds`))
      }, timeoutInSeconds * 1000)
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const listFn = () => this.appsV1Api.listNamespacedDeployment({namespace: this.namespace})
      const informer = makeInformer(this.kc, `/apis/apps/v1/namespaces/${this.namespace}/deployments/`, listFn)
      informer.on('update', (obj: V1Deployment) => {
        const conditions = obj?.status?.conditions
        if (conditions && obj?.metadata?.name === deploymentName) {
          const progressingCondition = conditions.find(c => c.type === 'Progressing')
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

  #validate(): void {
    if (this.namespace === Undefined) {
      this.command.error(
        'namespace is undefined',
        {
          suggestions: [
            'set namespace with -n',
            'configure service account for this deployment/job',
          ],
        },
      )
    }
  }
}
