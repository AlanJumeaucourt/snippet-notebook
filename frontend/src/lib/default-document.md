# Snippet Notebook

One markdown file for notes and command snippets. Define values in `vars` fences; use placeholders in fenced code blocks only.

- **Sidebar** — heading outline follows scroll; click to jump
- **Fold** — click **▸** in the gutter to collapse a section or code block; **Ctrl/Cmd+Shift+[** / **]** to fold/unfold at cursor
- **Variables** — click a purple placeholder in a code or `vars` block to pick a value; green `→ value (LABEL)` shows what **Copy** will use
- **Copy snippet** — **Copy** on each ` ```lang ` fence (**Ctrl/Cmd+Shift+C** in block); warns when variables are unset; **Ctrl/Cmd+click** opens an optional resolved preview
- **Copy for sharing** — sidebar button keeps `{{placeholders}}` but clears `vars` values (safe to paste)
- **Find** — **Ctrl/Cmd+F** with match counter and ▲/▼ navigation
- **New section** — **Ctrl/Cmd+N** or **+ Section** in the sidebar
- **Section links** — `[label](#anchor-id)` then **Ctrl/Cmd+click** the link (same ids as the sidebar)
- **Sync (optional)** — sidebar **Sync** panel for encrypted P2P edit across devices

## Naming globals (multi-app notebooks)

Use a prefix per app, then consistent suffixes. Duplicate the block below when onboarding a new app.

| Suffix | Example |
|--------|---------|
| `_app_name` | `demo` |
| `_gitlab_project_id` | numeric project id |
| `_int_runner_ip` / `_prd_runner_ip` | integration / production runner |

```vars global
# ── Identity (shared) ────────────────────────────────────────────────────────
user_id = your-user-id
account_ref = your-account-ref
work_email = you@example.com

# ── Demo app (template — copy and rename the prefix) ─────────────────────────
demo_app_name:demo
demo_gitlab_group_id:12345
demo_gitlab_project_id:67890
demo_int_runner_ip:10.0.0.11
demo_prd_runner_ip:10.0.0.12

# ── Another app (same shape) ─────────────────────────────────────────────────
sample_app_name:sample
sample_int_runner_ip:10.0.0.21
sample_prd_runner_ip:10.0.0.22
```

## SSH via bastion (multi-option var)

Pick **DEV**, **STAGING**, or **PROD** — only the IP is copied into the snippet.

```vars
target_host = 10.0.0.10 | DEV:10.0.0.10, STAGING:10.0.0.20, PROD:10.0.0.30
```

Click `target_host` in the bash block below (not in this prose line).

```bash
ssh {{user_id}}@bastion.example.com#{{target_host}}@jump.example.com
```

## Runner IPs (colon globals + regex picker)

Many globals use `NAME:value` (no `=`). A local var with a regex lists every matching global; the **value** (e.g. IP) is copied.

```vars
machine = name:/_runner_ip$/
app_only = name:/^demo_.*_runner_ip$/
```

| Line | Matches globals where… |
|------|------------------------|
| `machine = name:/_runner_ip$/` | **name** ends with `_runner_ip` |
| `app_only = name:/^demo_.*_runner_ip$/` | **name** matches `demo_*_runner_ip` only |

```bash
ssh {{user_id}}@bastion.example.com\${{account_ref}}-R@bastion.example.com#bastion.example.com\${{machine}}@jump.example.com
```

## HTTP proxy (PowerShell)

Corporate proxy on Windows — set CA bundle path to your trust store.

```powershell
$env:HTTP_PROXY="http://proxy.example.com:8080"
$env:HTTPS_PROXY="http://proxy.example.com:8080"
$env:REQUESTS_CA_BUNDLE="$env:USERPROFILE\certs\corp-ca.pem"
```

## HTTP proxy (bash)

Local vars can reference globals (`work_email`, `user_id`).

```vars
proxy_user = proxy-user
proxy_pass = your-proxy-password
registry_email = {{work_email}}
```

See also [HTTP proxy (PowerShell)](#http-proxy-powershell).

```bash
export http_proxy='http://{{proxy_user}}:{{proxy_pass}}@proxy.example.com:8000'
export https_proxy='http://{{proxy_user}}:{{proxy_pass}}@proxy.example.com:8000'
export no_proxy='localhost,127.0.0.1,::1,*.example.com'
export REGISTRY_MAIL="{{registry_email}}"
```

## Deploy helper (linked globals)

Local vars pull from globals; keep tokens as placeholders until you paste your own.

```vars
api_user = {{user_id}}
api_token = your-api-token
runner_token = your-runner-token
runner_name = my-runner
```

```bash
export API_USER="{{api_user}}"
export API_TOKEN="{{api_token}}"
export RUNNER_TOKEN="{{runner_token}}"
export RUNNER_NAME="{{runner_name}}"
curl -fsSL -u "$API_USER:$API_TOKEN" https://artifacts.example.com/install/latest.sh -o install.sh
chmod +x install.sh
./install.sh
```

## Container registry login

Requires cloud CLI auth on your machine first.

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

## Disk / LVM grow (bash)

After a cloud disk resize on a VM with NVMe + LVM root.

```bash
sudo dnf install -y cloud-utils-growpart
sudo growpart /dev/nvme0n1 3
sudo partprobe /dev/nvme0n1
sudo pvresize /dev/nvme0n1p3
sudo lvextend -l +100%FREE -r /dev/mapper/vg-root
vgs && lvs && df -h /
```

## Variable syntax reminder

```vars global
name = value
choice = 10.0.0.1 | DEV:10.0.0.1, PROD:10.0.0.2
linked = {{user_id}}
RUNNER_IP:10.0.0.99
```

```vars
machine = /_RUNNER_IP$/
subnet = value:/^10\.0\.0\./
runner = name:/_runner_ip$/
```

- `NAME:value` — compact global (colon, no `=`)
- `name = /pattern/` — regex on global **name or value** (default)
- `name = name:/pattern/` — regex on **names** only
- `name = value:/pattern/` — regex on **values** only
- `LABEL:value` only when the picker needs a friendly label (e.g. `PROD:10.0.0.1`); plain values are not repeated as `value | value`
