import {Flags} from '@oclif/core'
export interface CommonFlagsInterface {
  config: string
  namespace: string | undefined,
  secret: string,
}

export enum ConfigType {
  InCluster = 'cluster',
  Local = 'local',
}

export default {
  additionalLabel: Flags.string({
    aliases: ['additional-label'], char: 'l', description: 'Add custom Kubernetes label (may be repeated)', multiple: true, required: false,
  }),
  config: Flags.string({
    aliases: ['config'], char: 'c', description: 'use local or in-cluster Kubernetes config', options: [ConfigType.Local, ConfigType.InCluster], required: true,
  }),
  namespace: Flags.string({
    aliases: ['namespace'], char: 'n', description: 'namespace, defaults to current namespace if service account is used', required: false,
  }),
  secret: Flags.string({
    aliases: ['secret'], char: 's', default: 'oidc-keys', description: 'secret name', required: false,
  }),
}
