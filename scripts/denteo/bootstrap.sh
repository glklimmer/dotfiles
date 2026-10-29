# shellcheck shell=bash
##
# denteo profile of ~/scripts/bootstrap, sourced by it once the dotfiles are
# checked out. Uses the main script's helpers (step, ask, ask_secret, has,
# ensure_private, install_flatpaks, install_claude_plugins).

DENTEO_APT_PACKAGES=(
  glab
  postgresql postgresql-16-pgvector libpq-dev libvips libicu-dev libyaml-dev qpdf qrencode ffmpeg dcmtk
)

DENTEO_FLATPAKS=(com.slack.Slack)

DENTEO_CLAUDE_PLUGINS=(
  slack@claude-plugins-official
  sentry-cli@claude-plugins-official
)

DENTEO_REPOS=(panter/dental denteo/dhc)

GITLAB_HOST=git.panter.ch

denteo_git_identity() {
  [ -f "$HOME/.gitconfig-denteo" ] && return
  git config --global includeIf."gitdir:~/denteo/".path "~/.gitconfig-denteo"
  git config -f "$HOME/.gitconfig-denteo" user.name "$(git config --global user.name)"
  git config -f "$HOME/.gitconfig-denteo" user.email "$(ask 'Denteo git email')"
}

denteo_gitlab_auth() {
  glab auth status --hostname "$GITLAB_HOST" &>/dev/null && return
  glab auth login --hostname "$GITLAB_HOST"
  glab ssh-key add "$HOME/.ssh/id_ed25519.pub" -t "$(hostname)" --hostname "$GITLAB_HOST" || true
}

denteo_sentry_env() {
  local rc="$HOME/.zshrc.local"
  grep -q '^export SENTRY_AUTH_TOKEN=' "$rc" 2>/dev/null && return
  local sentry_url sentry_token
  sentry_url="$(ask 'Sentry URL')"
  sentry_token="$(ask_secret 'Sentry auth token')"
  ensure_private "$rc"
  cat >>"$rc" <<EOF

# Sentry CLI
export SENTRY_URL=$sentry_url
export SENTRY_AUTH_TOKEN=$sentry_token
export SENTRY_FORCE_ENV_TOKEN=1
EOF
}

##
# Adds the tridactyl `login` command for the denteo dev admin to the
# machine-local tridactylrc, which keeps the password out of the dotfiles.
denteo_tridactyl_login() {
  local rc="$HOME/.config/tridactyl/tridactylrc.local"
  grep -q '^command login ' "$rc" 2>/dev/null && return
  local password
  password="$(ask_secret 'Denteo dev denteo_admin password')"
  ensure_private "$rc"
  printf 'command login js -d€ -r login.js€ %s\n' "$password" >>"$rc"
}

setup_denteo() {
  step "denteo"
  sudo apt-get install -y "${DENTEO_APT_PACKAGES[@]}"
  install_flatpaks "${DENTEO_FLATPAKS[@]}"
  install_claude_plugins "${DENTEO_CLAUDE_PLUGINS[@]}"
  denteo_git_identity
  denteo_gitlab_auth
  denteo_sentry_env
  denteo_tridactyl_login

  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$USER'" | grep -q 1 ||
    sudo -u postgres createuser --superuser "$USER"

  mkdir -p "$HOME/denteo"
  local repo dir
  for repo in "${DENTEO_REPOS[@]}"; do
    dir="$HOME/denteo/$(basename "$repo")"
    [ -d "$dir" ] || git clone "git@$GITLAB_HOST:$repo.git" "$dir" ||
      echo "Could not clone $repo — add your SSH key to $GITLAB_HOST and re-run."
  done

  if [ -d "$HOME/denteo/dental" ]; then
    (
      cd "$HOME/denteo/dental" || exit
      "$HOME/.local/bin/mise" trust
      "$HOME/.local/bin/mise" install
      "$HOME/.local/bin/mise" exec -- bun install
      "$HOME/.local/bin/mise" exec -- bunx playwright install --with-deps chromium
    )
  fi
  NEXT_STEPS+=("run bin/setup in ~/denteo/dental")
}
