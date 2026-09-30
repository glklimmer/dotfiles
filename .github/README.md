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

Afterwards, log out and back in (zsh becomes the login shell) and run `bin/setup`
in `~/denteo/dental`. Cloning the Denteo repos needs an SSH key on
git.panter.ch; without one that step is skipped with a warning.

### Installing something new

Add it to `scripts/bootstrap` instead of installing it by hand, then run
`bootstrap`, so the script stays the source of truth for this machine.

## Usage

Use alias `dotfiles` as if it was `git`:

```bash
dotfiles pull
```
