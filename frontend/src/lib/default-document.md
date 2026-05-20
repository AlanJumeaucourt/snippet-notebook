# Snippet Notebook

One markdown file for notes and snippets. Use `{{name}}` in code blocks; define values in `vars` fences.

- **Sidebar** — headings outline, click to jump
- **Variables inline** — click `{{name}}` to change it; multiple choices use a labeled menu (`DEV`, `PROD`, …); green `→ value (LABEL)` shows what gets copied
- **Copy snippet** — **Copy** button on each ` ```lang ` fence (`Ctrl+Shift+C` in block); Ctrl+click opens optional preview when the block has `{{placeholders}}`
- **Find** — `Ctrl+F` / `Cmd+F`
- **New section** — `Ctrl+N`
- **Section links** — `[label](#anchor-id)` then **Ctrl+click** (or **Cmd+click**) the link; anchor id matches the sidebar (hover a heading to see `#anchor-id`). Duplicate titles get `-1`, `-2`, …

```vars global
user_id = your-user-id
account_ref = your-account-ref
work_email = you@example.com
```

## HTTP proxy (PowerShell)

Use behind a corporate proxy on Windows.

```powershell
$env:HTTP_PROXY="http://proxy.example.com:8080"
$env:HTTPS_PROXY="http://proxy.example.com:8080"
$env:REQUESTS_CA_BUNDLE="$env:USERPROFILE\certs\corp-ca.pem"
```

## HTTP proxy (bash)

```vars
proxy_user = proxy-user
proxy_pass = your-proxy-password
```

```bash
export http_proxy='http://{{proxy_user}}:{{proxy_pass}}@proxy.example.com:8000'
export https_proxy='http://{{proxy_user}}:{{proxy_pass}}@proxy.example.com:8000'
export no_proxy='localhost,127.0.0.1,::1,*.example.com'
```

## SSH via bastion

```vars
target_host = 10.0.0.10 | DEV:10.0.0.10, STAGING:10.0.0.20, PROD:10.0.0.30
```

Click the purple **{{target_host}}** in the **bash block below** (not this line) — choose **DEV**, **STAGING**, or **PROD** (only the IP is copied). You can also click the green preview after it.

```bash
ssh {{user_id}}@bastion.example.com#{{target_host}}@jump.example.com
```

## Deploy script with secrets

Local vars can reference globals (`{{work_email}}`, `{{user_id}}`).

```vars
registry_email = {{work_email}}
registry_token = your-artifactory-token
api_user = {{user_id}}
api_token = your-api-token
runner_token = your-runner-token
runner_name = my-runner
```

```bash
export REGISTRY_MAIL="{{registry_email}}"
export REGISTRY_TOKEN="{{registry_token}}"
export API_USER="{{api_user}}"
export API_TOKEN="{{api_token}}"
export RUNNER_TOKEN="{{runner_token}}"
export RUNNER_NAME="{{runner_name}}"
curl -fsSL -u "$API_USER:$API_TOKEN" https://artifacts.example.com/install/latest.sh -o install.sh
chmod +x install.sh
./install.sh
```

## Disk / LVM grow (bash)

```bash
sudo dnf install -y cloud-utils-growpart
growpart /dev/nvme0n1 3
sudo partprobe /dev/nvme0n1
sudo pvresize /dev/nvme0n1p3
sudo lvextend -l +100%FREE -r /dev/mapper/vg-root
vgs && lvs && df -h /
```

## Container registry login

See [HTTP proxy (bash)](#http-proxy-bash) if you need outbound access first.

```vars
project_id = my-project-12345
region = europe-west1
```

```bash
export PROJECT_ID='{{project_id}}'
export REGION='{{region}}'
REGISTRY="$(gcloud artifacts repositories list \
  --project="${PROJECT_ID}" --location="${REGION}" \
  --format='value(name)' | awk 'NR==1{print $1}')"
REGISTRY_URL="$(gcloud artifacts repositories describe "${REGISTRY}" \
  --project="${PROJECT_ID}" --location="${REGION}" \
  --format='value(registryUri)' | tr -d '\r\n')"
TOKEN="$(gcloud auth print-access-token | tr -d '\r\n')"
printf '%s' "${TOKEN}" | podman login "${REGISTRY_URL%%/*}" --username oauth2accesstoken --password-stdin
```

### Variable syntax reminder

```vars global
name = value
choice = 10.0.0.1 | DEV:10.0.0.1, PROD:10.0.0.2
linked = {{user_id}}
```

`LABEL:value` only when you want a friendly name in the picker (e.g. `PROD:10.0.0.1`). Plain values are not repeated as `value | value`.
