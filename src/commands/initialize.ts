import {Command, Flags} from '@oclif/core'

import commonFlags from '../helpers/common-flags'
import {KubeApiService} from '../helpers/kube-api-service'
import {Secret} from '../helpers/secret'
export default class Initialize extends Command {
  static args = {}
  static description = 'Initialize the secret with initial keys'
  public static enableJsonFlag = true
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> -n <kube namespace> -s <secret name>',
    '<%= config.bin %> <%= command.id %> --namespace <kube namespace> --secret <secret name> --recreate',
    '<%= config.bin %> <%= command.id %> --additional-label "app.kubernetes.io/instance: passmower"',
  ]
  static flags = {
    ...commonFlags,
    recreate: Flags.boolean({aliases: ['recreate'], description: 'recreate the secret if it exists', required: false}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Initialize)
    const kubeApiService = new KubeApiService(this, flags)
    kubeApiService.printConfiguration()

    const exists = await kubeApiService.getSecret()
    if (exists && !flags.recreate) {
      return
    }

    if (exists) {
      await kubeApiService.deleteSecret()
    }

    const secret = new Secret(this)
    this.log('Generating secret')
    secret.generateNew()

    await kubeApiService.createSecret(secret, flags.additionalLabel)
  }
}
