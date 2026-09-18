import {V1ObjectMeta, V1Secret} from '@kubernetes/client-node'
import {Command} from '@oclif/core'
import {JwkObject, KEYUTIL} from 'jsrsasign'
import crypto from 'node:crypto'

const JWKSKeyName = 'OIDC_JWKS'
const CookieKeysKeyName = 'OIDC_COOKIE_KEYS'

type FullJwkObject = JwkObject & {use: string}
type SecretProperties = 'CookieKeys' | 'JWKs';

export class Secret {
  private command: Command
  private CookieKeys: Array<FullJwkObject | string>
  private JWKs: Array<FullJwkObject | string>

  constructor(command: Command) {
    this.JWKs = []
    this.CookieKeys = []
    this.command = command
  }

  appendCookieKey(maxNumber: number): void {
    this.#append('CookieKeys', maxNumber, () => this.#generateCookieKey(32))
  }

  appendJWK(maxNumber: number): void {
    this.#append('JWKs', maxNumber, () => this.#generateRSAJwk(4096))
  }

  fromKubeSecret(kubeSecret: V1Secret): void {
    const data = kubeSecret?.data ?? {}
    this.JWKs = JSON.parse(Buffer.from(data[JWKSKeyName], 'base64').toString())
    this.CookieKeys = JSON.parse(Buffer.from(data[CookieKeysKeyName], 'base64').toString())
  }

  generateNew(): void {
    this.JWKs = [this.#generateRSAJwk(4096)]
    this.CookieKeys = [this.#generateCookieKey(32)]
  }

  rotateCookieKeys(): void {
    this.#rotate('CookieKeys')
  }

  rotateJWKs(): void {
    this.#rotate('JWKs')
  }

  toKubeSecret(secretName: string, labels?: string[]): V1Secret {
    const secret = new V1Secret()
    secret.metadata = this.#getKubeSecretMetadata(secretName, labels)
    secret.data = {}
    secret.data[JWKSKeyName] = this.#arrayToB64String(this.JWKs)
    secret.data[CookieKeysKeyName] = this.#arrayToB64String(this.CookieKeys)
    return secret
  }

  #append(property: SecretProperties, maxNumber: number, generatorFn: () => FullJwkObject | string): void {
    if (this[property].length + 1 > maxNumber) {
      this.command.log(`Removing extra ${this[property].length + 1 - maxNumber} ${property}`)
      this[property].splice(maxNumber - 1)
    }

    this.command.log(`Appending new value to end of ${property}`)
    this[property] = [...this[property], generatorFn()]
  }

  #arrayToB64String(array: Array<FullJwkObject | string>): string {
    const b = Buffer.from(JSON.stringify(array))
    return b.toString('base64')
  }

  #generateCookieKey(size: number): string {
    return crypto.randomBytes(size).toString('hex')
  }

  #generateRSAJwk(len: number): FullJwkObject {
    this.command.log(`Generating ${len}bit RSA key pair`)
    const keypair = KEYUTIL.generateKeypair('RSA', len)
    const jwk = KEYUTIL.getJWK(keypair.prvKeyObj)
    return {
      ...jwk,
      use: 'sig',
    }
  }

  #getKubeSecretMetadata(secretName: string, labels?: string[]): V1ObjectMeta {
    const metaData = new V1ObjectMeta()
    metaData.name = secretName
    if (labels && labels.length > 0) {
      metaData.labels = {}
      for (const label of labels) {
        const [key, ...valueParts] = label.split(':')
        const value = valueParts.join(':').trim()
        if (key && value) {
          metaData.labels[key.trim()] = value
        }
      }
    }

    return metaData
  }

  #rotate(property: SecretProperties): void {
    this.command.log(`Rotating new value to the start of ${property}`)
    const newValue = this[property].pop()
    if (newValue) {
      this[property] = [newValue, ...this[property]]
    }
  }
}
