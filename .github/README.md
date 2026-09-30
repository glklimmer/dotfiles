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

## Usage

Use alias `dotfiles` as if it was `git`:

```bash
dotfiles pull
```
