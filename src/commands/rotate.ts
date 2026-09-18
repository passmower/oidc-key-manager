import {Command, Flags} from '@oclif/core'

import commonFlags from '../helpers/common-flags'
import {KubeApiService} from '../helpers/kube-api-service'
import {Secret} from '../helpers/secret'

export default class Rotate extends Command {
  static args = {}
  static description = 'Append new JWK|cookie key|both and rotate the array, optionally restarting the deployment'
  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]
  static flags = {
    ...commonFlags,
    both: Flags.boolean({description: 'rotate both JWKs and cookie keys', exactlyOne: ['both', 'jwks', 'cookie-keys']}),
    'cookie-keys': Flags.boolean({description: 'rotate cookie keys'}),
    jwks: Flags.boolean({description: 'rotate JWKs'}),
    'max-number-of-cookie-keys': Flags.integer({default: 3}),
    'max-number-of-jwks': Flags.integer({default: 3}),
    'restart-deployment': Flags.string({description: 'Kubernetes deployment name to restart while rotating'}),
    'restart-deployment-backoff': Flags.integer({default: 60, dependsOn: ['restart-deployment'], description: 'Seconds to wait for deployment to restart'}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Rotate)
    const kubeApiService = new KubeApiService(this, flags)
    kubeApiService.printConfiguration()

    const kubeSecret = await kubeApiService.getSecret()
    if (!kubeSecret) {
      this.error('Secret does not exist')
    }

    const secret = new Secret(this)
    secret.fromKubeSecret(kubeSecret)

    if (flags.both || flags.jwks) {
      secret.appendJWK(flags['max-number-of-jwks'])
    }

    if (flags.both || flags['cookie-keys']) {
      secret.appendCookieKey(flags['max-number-of-cookie-keys'])
    }

    await kubeApiService.replaceSecret(secret, flags.additionalLabel)

    let restarted = false

    if (flags['restart-deployment']) {
      try {
        await kubeApiService.restartDeployment(flags['restart-deployment'], flags['restart-deployment-backoff'])
        restarted = true
      } catch (error) {
        this.log('Restarting deployment failed', error)
        restarted = false
      }
    }

    if (flags.both || flags.jwks) {
      secret.rotateJWKs()
    }

    if (flags.both || flags['cookie-keys']) {
      secret.rotateCookieKeys()
    }

    await kubeApiService.replaceSecret(secret, flags.additionalLabel)

    if (flags['restart-deployment']) {
      try {
        await kubeApiService.restartDeployment(flags['restart-deployment'], flags['restart-deployment-backoff'])
        restarted = true
      } catch (error) {
        this.log('Restarting deployment failed, proceeding', error)
        restarted = false
      }
    }

    this.log('Keys rotated' + (restarted ? '' : ', but deployment not restarted'))
  }
}
