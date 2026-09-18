import net from 'node:net'

// loadFromCluster() builds the API server URL straight from KUBERNETES_SERVICE_HOST,
// which on IPv6-only / dual-stack clusters is a bare IPv6 literal — so the client
// connects to https://[fd00::1]:443. The kube-apiserver serving cert always lists the
// DNS names (kubernetes.default.svc, ...) but not necessarily every ClusterIP as an IP
// SAN, so connecting by literal IP fails TLS verification with "Hostname/IP does not
// match certificate's altnames" on some clusters. The in-cluster DNS name
// kubernetes.default.svc is always present in the cert SANs, so we rewrite the server to
// use it and let the pod resolver pick the right address family.
//
// Gated by KUBERNETES_API_SERVICE_DNS: 'auto' (default) only rewrites when the host is an
// IPv6 literal (IPv4 clusters that work today are untouched); 'always' forces it; 'never'
// disables it. Returns the replacement server URL, or null to leave it as-is.
export function apiServerUrlViaServiceDns({
  host = process.env.KUBERNETES_SERVICE_HOST,
  mode = process.env.KUBERNETES_API_SERVICE_DNS ?? 'auto',
  port = process.env.KUBERNETES_SERVICE_PORT,
}: {host?: string; mode?: string; port?: string;} = {}): null | string {
  if (!host || mode === 'never') {
    return null
  }

  if (mode !== 'always' && !net.isIPv6(host)) {
    return null
  }

  const scheme = (port === '80' || port === '8080' || port === '8001') ? 'http' : 'https'
  return `${scheme}://kubernetes.default.svc:${port}`
}
