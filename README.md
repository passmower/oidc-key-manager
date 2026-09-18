oidc-key-manager
=================

CLI to manage secret keys required by oidc-gateway

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @passmower/oidc-key-manager
$ key-manager COMMAND
running command...
$ key-manager (--version)
@passmower/oidc-key-manager/1.2.3 linux-x64 node-v22.22.2
$ key-manager --help [COMMAND]
USAGE
  $ key-manager COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`key-manager initialize`](#key-manager-initialize)
* [`key-manager rotate`](#key-manager-rotate)

## `key-manager initialize`

Initialize the secret with initial keys

```
USAGE
  $ key-manager initialize -c local|cluster [--json] [-l <value>...] [-n <value>] [-s <value>] [--recreate]

FLAGS
  -c, --config=<option>             (required) use local or in-cluster Kubernetes config
                                    <options: local|cluster>
  -l, --additionalLabel=<value>...  Add custom Kubernetes label (may be repeated)
  -n, --namespace=<value>           namespace, defaults to current namespace if service account is used
  -s, --secret=<value>              [default: oidc-keys] secret name
      --recreate                    recreate the secret if it exists

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Initialize the secret with initial keys

EXAMPLES
  $ key-manager initialize

  $ key-manager initialize

  $ key-manager initialize -n <kube namespace> -s <secret name>

  $ key-manager initialize --namespace <kube namespace> --secret <secret name> --recreate

  $ key-manager initialize --additional-label "app.kubernetes.io/instance: passmower"
```

_See code: [src/commands/initialize.ts](https://github.com/passmower/oidc-key-manager/blob/v1.2.3/src/commands/initialize.ts)_

## `key-manager rotate`

Append new JWK|cookie key|both and rotate the array, optionally restarting the deployment

```
USAGE
  $ key-manager rotate -c local|cluster [-l <value>...] [-n <value>] [-s <value>] [--both] [--cookie-keys]
    [--jwks] [--max-number-of-cookie-keys <value>] [--max-number-of-jwks <value>] [--restart-deployment-backoff <value>
    --restart-deployment <value>]

FLAGS
  -c, --config=<option>                     (required) use local or in-cluster Kubernetes config
                                            <options: local|cluster>
  -l, --additionalLabel=<value>...          Add custom Kubernetes label (may be repeated)
  -n, --namespace=<value>                   namespace, defaults to current namespace if service account is used
  -s, --secret=<value>                      [default: oidc-keys] secret name
      --both                                rotate both JWKs and cookie keys
      --cookie-keys                         rotate cookie keys
      --jwks                                rotate JWKs
      --max-number-of-cookie-keys=<value>   [default: 3]
      --max-number-of-jwks=<value>          [default: 3]
      --restart-deployment=<value>          Kubernetes deployment name to restart while rotating
      --restart-deployment-backoff=<value>  [default: 60] Seconds to wait for deployment to restart

DESCRIPTION
  Append new JWK|cookie key|both and rotate the array, optionally restarting the deployment

EXAMPLES
  $ key-manager rotate
```

_See code: [src/commands/rotate.ts](https://github.com/passmower/oidc-key-manager/blob/v1.2.3/src/commands/rotate.ts)_
<!-- commandsstop -->
