# dotfiles

## New machine

On a fresh Pop!_OS / Ubuntu install, run the bootstrap script. It clones these
dotfiles and installs every tool and program they rely on:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/glklimmer/dotfiles/master/scripts/bootstrap)
```

It is safe to re-run: each step skips what is already installed. Run it again
after adding something to it:

```bash
bootstrap
```

It asks for your git name and emails and the Sentry URL/token, and walks you
through `gh` / `glab` login (uploading a fresh SSH key). Nothing personal or
secret is committed here: git identity lives in `~/.gitconfig{,-denteo}` and
secrets in `~/.zshrc.local`, both machine-local.

Afterwards, log out and back in (zsh becomes the login shell) and run `bin/setup`
in `~/denteo/dental`.

### Installing something new

Add it to `scripts/bootstrap` instead of installing it by hand, then run
`bootstrap`, so the script stays the source of truth for this machine.

### Patched cosmic-comp

`focus_edge_navigation` and `move_edge_navigation` in
`.config/cosmic/com.system76.CosmicComp/v1/workspaces` stop Super+H/J/K/L from
switching workspaces (only Super+Ctrl does, like Pop Shell). They only take
effect with cosmic-comp built from
[pop-os/cosmic-comp#2755](https://github.com/pop-os/cosmic-comp/pull/2755);
stock builds ignore them. Rebuild after every `cosmic-comp` apt update until the
PR is merged:

```bash
sudo apt install cmake libegl1-mesa-dev libfontconfig-dev libgbm-dev \
  libinput-dev libpixman-1-dev libseat-dev libsystemd-dev libudev-dev \
  libwayland-dev libxcb1-dev libxkbcommon-dev libdisplay-info-dev
git clone https://github.com/pop-os/cosmic-comp.git ~/development/cosmic-comp
cd ~/development/cosmic-comp
git fetch origin pull/2755/head:pr-2755
git checkout -b patched "$(dpkg-query -W -f='${Version}' cosmic-comp | sed 's/.*~//')"
git merge --no-edit pr-2755
cargo build --release
sudo install -m755 target/release/cosmic-comp /usr/bin/cosmic-comp
```

Log out and back in afterwards.

## Usage

Use alias `dotfiles` as if it was `git`:

```bash
dotfiles pull
```
